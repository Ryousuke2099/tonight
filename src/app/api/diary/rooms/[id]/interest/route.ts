import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * モードA（面識のない相手）の部屋で「知人になって続けたい」を指定する。
 * 相互に指定が揃った瞬間、friendships へ双方向で書き込む — これが
 * architecture doc に書いた「知人化ブリッジ」の実装。cross-user write な
 * ので、/api/friends の add-by-email と同じく service-role クライアントを
 * 使う（RLSは自分の行しかinsertできないため）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { interested?: boolean };
  const interested = body.interested !== false; // デフォルトtrue。falseで取り消しも可。

  const { data: room, error: roomError } = await supabase.from("diary_rooms").select("*").eq("id", id).maybeSingle();
  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (room.mode !== "a") {
    return NextResponse.json({ error: "モードBの相手はすでに知人です" }, { status: 400 });
  }
  if (room.converted_to_friend_at) {
    return NextResponse.json({ room });
  }

  const iAmA = room.user_a === user.id;
  const patch = iAmA ? { interest_a: interested } : { interest_b: interested };
  const { data: updated, error: updateError } = await supabase
    .from("diary_rooms")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (updated.interest_a && updated.interest_b && !updated.converted_to_friend_at) {
    const admin = createAdminClient();
    const { error: friendError } = await admin.from("friendships").upsert(
      [
        { user_id: updated.user_a, friend_id: updated.user_b },
        { user_id: updated.user_b, friend_id: updated.user_a },
      ],
      { onConflict: "user_id,friend_id", ignoreDuplicates: true }
    );
    if (friendError) return NextResponse.json({ error: friendError.message }, { status: 500 });

    const { data: converted, error: convertError } = await admin
      .from("diary_rooms")
      .update({ converted_to_friend_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (convertError) return NextResponse.json({ error: convertError.message }, { status: 500 });

    return NextResponse.json({ room: converted, becameFriends: true });
  }

  return NextResponse.json({ room: updated, becameFriends: false });
}
