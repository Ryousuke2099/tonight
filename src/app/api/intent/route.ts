import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeMatchesForUser } from "@/lib/match";
import { ensureDemoCompanionsActiveFor } from "@/lib/demo-companions";
import type { IntentMode, SlotIndex } from "@/types/db";

interface IntentBody {
  date: string; // YYYY-MM-DD
  mode: IntentMode;
  targetIds: string[]; // only used when mode === 'selected'
  slots: SlotIndex[];
}

// Returns the caller's OWN saved intent/availability for a date, if any.
// (Never another user's — this endpoint is auth-scoped via RLS.)
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { data: intent } = await supabase
    .from("daily_intents")
    .select("id, mode")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (!intent) return NextResponse.json({ intent: null });

  let targetIds: string[] = [];
  if (intent.mode === "selected") {
    const { data: targets } = await supabase
      .from("intent_targets")
      .select("target_user_id")
      .eq("intent_id", intent.id);
    targetIds = (targets ?? []).map((t) => t.target_user_id as string);
  }

  const { data: availability } = await supabase
    .from("availabilities")
    .select("slots")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  return NextResponse.json({
    intent: {
      mode: intent.mode as IntentMode,
      targetIds,
      slots: (availability?.slots as SlotIndex[] | undefined) ?? [],
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as IntentBody;
  if (!body.date || (body.mode !== "anyone" && body.mode !== "selected")) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Own-row writes go through the RLS-scoped client — the policies already
  // guarantee a user can only ever write their own intent/targets/availability.
  const { data: intent, error: intentError } = await supabase
    .from("daily_intents")
    .upsert(
      { user_id: user.id, date: body.date, mode: body.mode, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" }
    )
    .select("id")
    .single();

  if (intentError || !intent) {
    return NextResponse.json({ error: intentError?.message ?? "failed to save intent" }, { status: 500 });
  }

  // Targets are saved regardless of mode now: in 'selected' mode they're a
  // hard restriction (who counts as a candidate at all); in 'anyone' mode
  // they're an optional priority list (who gets sorted/badged first if a
  // match happens) — see recomputeMatchesForUser / getMatchesForUser.
  await supabase.from("intent_targets").delete().eq("intent_id", intent.id);
  if (body.targetIds.length > 0) {
    await supabase.from("intent_targets").insert(
      body.targetIds.map((targetId) => ({ intent_id: intent.id, target_user_id: targetId }))
    );
  }

  const { error: availError } = await supabase.from("availabilities").upsert(
    { user_id: user.id, date: body.date, slots: body.slots, updated_at: new Date().toISOString() },
    { onConflict: "user_id,date" }
  );
  if (availError) {
    return NextResponse.json({ error: availError.message }, { status: 500 });
  }

  // Matching requires reading other users' intents/availability — deliberately
  // routed through the service-role admin client, never the RLS-scoped one.
  const admin = createAdminClient();
  await ensureDemoCompanionsActiveFor(admin, body.date);
  const matches = await recomputeMatchesForUser(admin, user.id, body.date);

  return NextResponse.json({ matches });
}
