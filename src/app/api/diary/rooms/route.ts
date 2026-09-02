import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orderPair } from "@/lib/diary";
import type { DiaryRoomWithPartner } from "@/types/db";

/** 自分が参加している交換日記の部屋一覧（モードA/B混在）。 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data: rooms, error } = await supabase
    .from("diary_rooms")
    .select("*")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rooms || rooms.length === 0) return NextResponse.json({ rooms: [] });

  const partnerIds = rooms.map((r) => (r.user_a === user.id ? r.user_b : r.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, is_demo")
    .in("id", partnerIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: latestEntries } = await supabase
    .from("diary_entries")
    .select("room_id, created_at")
    .in(
      "room_id",
      rooms.map((r) => r.id)
    )
    .order("created_at", { ascending: false });
  const latestByRoom = new Map<string, string>();
  (latestEntries ?? []).forEach((e) => {
    if (!latestByRoom.has(e.room_id)) latestByRoom.set(e.room_id, e.created_at);
  });

  const result: DiaryRoomWithPartner[] = rooms.map((r) => {
    const iAmA = r.user_a === user.id;
    const partnerId = iAmA ? r.user_b : r.user_a;
    return {
      ...r,
      partner: profileMap.get(partnerId) ?? { id: partnerId, name: "相手", avatar_url: null, is_demo: false },
      my_interest: iAmA ? r.interest_a : r.interest_b,
      partner_interest: iAmA ? r.interest_b : r.interest_a,
      latest_entry_at: latestByRoom.get(r.id) ?? null,
    };
  });

  return NextResponse.json({ rooms: result });
}

/**
 * モードB（既存の友達と直接はじめる）の部屋を作る。モードAは
 * /api/diary/queue 経由のマッチングでのみ作られる（RLSでも同様に制限）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { friendId?: string };
  const friendId = body.friendId;
  if (!friendId) return NextResponse.json({ error: "friendId is required" }, { status: 400 });
  if (friendId === user.id) return NextResponse.json({ error: "自分自身とは始められません" }, { status: 400 });

  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_id", user.id)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (!friendship) {
    return NextResponse.json({ error: "友達同士だけがモードBを始められます" }, { status: 403 });
  }

  const [userA, userB] = orderPair(user.id, friendId);

  const { data: existing } = await supabase
    .from("diary_rooms")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .eq("mode", "b")
    .maybeSingle();
  if (existing) return NextResponse.json({ roomId: existing.id });

  const { data: room, error } = await supabase
    .from("diary_rooms")
    .insert({ user_a: userA, user_b: userB, mode: "b" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ roomId: room.id });
}
