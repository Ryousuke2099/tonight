// 交換日記の「今夜」の窓（20:00 JST 〜 翌20:00 JST）。supabase/
// woolink_diary_exchange_migration.sql の submit_diary() 内の日付計算と
// 完全に一致させる必要がある — ズレると「まだ提出できる」と表示したのに
// RPC 側は「今夜の分はもう提出済み」とエラーを返す、といった不整合が起きる。
//
// tonight/src/lib/date.ts の tonightDateJST() と同じ「toLocaleString で
// Asia/Tokyo に変換してから、そのフィールドをローカルタイムのものとして
// 扱う」トリックを使う（このアプリは Asia/Tokyo 専用なので許容している既存パターン）。
// ただし tonightDateJST() は 6:00 で日付が切り替わる別ルール（通話の待ち合わせ
// 窓20:00〜26:00用）なので流用できない。こちらは 20:00 切り替えの別ルール。
export function diaryWindowStart(now: Date = new Date()): Date {
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const start = new Date(jst.getFullYear(), jst.getMonth(), jst.getDate(), 20, 0, 0, 0);
  if (jst.getHours() < 20) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}
