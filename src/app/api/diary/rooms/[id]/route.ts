import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DiaryEntry, DiaryRoomWithPartner } from "@/types/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  // RLS scopes this to rooms the caller is part of.
  const { data: room, error } = await supabase.from("diary_rooms").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });

  const iAmA = room.user_a === user.id;
  const partnerId = iAmA ? room.user_b : room.user_a;
  const { data: partner } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, is_demo")
    .eq("id", partnerId)
    .maybeSingle();

  const { data: entries, error: entriesError } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("room_id", id)
    .order("created_at", { ascending: true });
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

  const roomWithPartner: DiaryRoomWithPartner = {
    ...room,
    partner: partner ?? { id: partnerId, name: "相手", avatar_url: null, is_demo: false },
    my_interest: iAmA ? room.interest_a : room.interest_b,
    partner_interest: iAmA ? room.interest_b : room.interest_a,
    latest_entry_at: entries && entries.length > 0 ? entries[entries.length - 1].created_at : null,
  };

  return NextResponse.json({ room: roomWithPartner, entries: (entries ?? []) as DiaryEntry[] });
}
