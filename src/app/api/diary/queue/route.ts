import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderPair, MODE_A_MAX_EXCHANGES, MODE_A_WINDOW_DAYS } from "@/lib/diary";

/**
 * モードA（面識のない相手）の待合室に並ぶ。元の exchange-diary は毎朝5時の
 * バッチ force-match だったが、ここでは「2人目が並んだ瞬間にその場で
 * マッチ」に簡略化（ハッカソンのデモで待ち時間を発生させたくないため）。
 * 相性判定は「同じ診断タイプを優先、いなければ一番長く待っている人」という
 * 単純な発見的規則 — 17タイプの本格的な相性表は
 * claude/tornado-2026-app-architecture.md の「未確定・要相談」に記載の通り
 * 今後の課題。
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("personality_type")
    .eq("id", user.id)
    .maybeSingle();

  const { error: upsertError } = await supabase
    .from("diary_match_queue")
    .upsert({ user_id: user.id, personality_type: profile?.personality_type ?? null }, { onConflict: "user_id" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // キューを跨いだ読み取りが必要なので、ここだけ service-role を使う
  // （/api/friends の add-by-email と同じパターン）。
  const admin = createAdminClient();
  const { data: candidates, error: listError } = await admin
    .from("diary_match_queue")
    .select("*")
    .neq("user_id", user.id)
    .order("joined_at", { ascending: true });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const myType = profile?.personality_type ?? null;
  const partner =
    (myType && candidates?.find((c) => c.personality_type === myType)) || candidates?.[0] || null;

  if (!partner) {
    return NextResponse.json({ matched: false });
  }

  const [userA, userB] = orderPair(user.id, partner.user_id);
  const windowExpiresAt = new Date(Date.now() + MODE_A_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: room, error: roomError } = await admin
    .from("diary_rooms")
    .insert({
      user_a: userA,
      user_b: userB,
      mode: "a",
      max_exchanges: MODE_A_MAX_EXCHANGES,
      window_expires_at: windowExpiresAt,
    })
    .select("id")
    .single();
  if (roomError) {
    // unique制約違反 = 既に同じ2人の部屋がある想定外ケース。安全側で待機扱いに。
    return NextResponse.json({ matched: false });
  }

  await admin.from("diary_match_queue").delete().in("user_id", [user.id, partner.user_id]);

  return NextResponse.json({ matched: true, roomId: room.id });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { error } = await supabase.from("diary_match_queue").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
