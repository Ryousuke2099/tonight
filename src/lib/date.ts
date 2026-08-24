/**
 * "Tonight"'s date, in Asia/Tokyo. The availability window runs 20:00 -> 02:00,
 * so between midnight and 06:00 we're still inside *last* night's window —
 * using the previous calendar date keeps both sides of a match on the same
 * `date` key instead of splitting at midnight.
 */
export function tonightDateJST(now: Date = new Date()): string {
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  if (jst.getHours() < 6) {
    jst.setDate(jst.getDate() - 1);
  }
  const y = jst.getFullYear();
  const m = (jst.getMonth() + 1).toString().padStart(2, "0");
  const d = jst.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${m}月${d}日（${weekday}）`;
}
