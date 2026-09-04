import { createClient } from "@/lib/supabase/client";

type SubmitDiaryResult = {
  submission_id: string;
  room_id: string | null;
};

/**
 * 交換日記を提出する。`submit_diary()` (supabase/woolink_diary_exchange_migration.sql)
 * が1トランザクションで: 1晩1提出のバリデーション → 公開ID指定 or 性格タイプに
 * よる自動マッチング → 両者そろえば rooms 行を作成、まで行う。
 */
export async function submitDiary(diary: string, targetPublicUserId: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_diary", {
    p_diary: diary.trim(),
    p_target_public_user_id: targetPublicUserId?.trim().toUpperCase() || null,
  });

  if (error) {
    throw new Error(error.message || "日記の提出に失敗しました。");
  }

  const result = (data?.[0] ?? null) as SubmitDiaryResult | null;

  if (!result) {
    throw new Error("日記の提出結果を確認できませんでした。");
  }

  return result;
}
