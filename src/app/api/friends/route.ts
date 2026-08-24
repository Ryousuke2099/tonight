import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { data: friendships, error } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const friendIds = (friendships ?? []).map((f) => f.friend_id as string);
  if (friendIds.length === 0) return NextResponse.json({ friends: [] });

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", friendIds);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ friends: profiles ?? [] });
}

/**
 * Add a friend by email. Deliberately simple for a small, trusted launch
 * circle: no request/approval step, both directions are written immediately
 * (friendships are symmetric — see schema.sql). This trades off the ability
 * for someone to add you without your separate confirmation; the privacy
 * guarantee that matters (nobody's nightly intent is ever shown one-sidedly)
 * is untouched, since matches still require independent, same-night opt-in
 * from both sides regardless of how the friendship itself was formed. If
 * this ever opens beyond a trusted circle, add a request/accept step here.
 *
 * Cross-user writes require the service-role client (same pattern as the
 * matcher and the guest-invite flow) since RLS only lets a user insert a
 * friendships row where they are `user_id`, not the mutual reverse row.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The Supabase JS admin SDK has no direct getUserByEmail in this version,
  // so page through listUsers like scripts/seed.ts does — fine at
  // friend-circle scale, but would need a real lookup (e.g. an indexed
  // `email` column on profiles) before this could scale past that.
  let target: { id: string } | null = null;
  let page = 1;
  while (!target) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    target = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (target || data.users.length < 200) break;
    page += 1;
  }

  if (!target) {
    return NextResponse.json(
      { error: "そのメールアドレスのTonightアカウントが見つかりませんでした" },
      { status: 404 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "自分自身は追加できません" }, { status: 400 });
  }

  const { error: insertError } = await admin.from("friendships").upsert(
    [
      { user_id: user.id, friend_id: target.id },
      { user_id: target.id, friend_id: user.id },
    ],
    { onConflict: "user_id,friend_id", ignoreDuplicates: true }
  );
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("id", target.id)
    .single();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ friend: profile });
}
