import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { intersectSlots, longestContiguousRun } from "@/lib/slots";
import type { GuestResponseType, SlotIndex } from "@/types/db";

interface RespondBody {
  guestName: string;
  response: GuestResponseType;
  slots: SlotIndex[];
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await request.json()) as RespondBody;

  if (!body.guestName?.trim() || (body.response !== "yes" && body.response !== "no")) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("invite_links")
    .select("id, date, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "invite expired" }, { status: 410 });
  }

  const slots = body.response === "yes" ? body.slots ?? [] : [];

  // Overlap with the inviter's own saved availability for that date, if any.
  let overlapStart: number | null = null;
  let overlapEnd: number | null = null;
  if (body.response === "yes") {
    const { data: inviteRow } = await admin
      .from("invite_links")
      .select("creator_user_id")
      .eq("id", invite.id)
      .single();

    if (inviteRow) {
      const { data: creatorAvail } = await admin
        .from("availabilities")
        .select("slots")
        .eq("user_id", inviteRow.creator_user_id)
        .eq("date", invite.date)
        .maybeSingle();

      if (creatorAvail?.slots) {
        const overlap = intersectSlots(slots, creatorAvail.slots as number[]);
        const run = longestContiguousRun(overlap);
        if (run) {
          overlapStart = run.start;
          overlapEnd = run.end;
        }
      }
    }
  }

  const { error: insertError } = await admin.from("guest_responses").insert({
    invite_id: invite.id,
    guest_name: body.guestName.trim(),
    response: body.response,
    slots,
    overlap_start: overlapStart,
    overlap_end: overlapEnd,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    overlapStart,
    overlapEnd,
    hasOverlap: overlapStart !== null,
  });
}
