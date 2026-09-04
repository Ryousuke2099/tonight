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

/** `n` consecutive YYYY-MM-DD date strings starting from `base` (defaults to
 * tonight's date). Used by the home-screen date picker to let people
 * register availability up to about a week ahead, not just tonight. */
export function nextNDatesJST(n: number, base: string = tonightDateJST()): string[] {
  const [y, m, d] = base.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const yy = dt.getFullYear();
    const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
    const dd = dt.getDate().toString().padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  });
}

/** Wall-clock Date for slot `slotIndex` on `dateStr` (YYYY-MM-DD). Slot 0 =
 * 20:00, 30-minute steps, late slots roll past midnight. Uses the runtime's
 * local timezone (the app is Asia/Tokyo-only). Used to schedule the
 * "話せる時間になりました" nudge on a match. */
export function slotDateTime(dateStr: string, slotIndex: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 20, slotIndex * 30);
}

/** Short label for the date-picker chips: "今日" / "明日" / "8/26（水）". */
export function formatDateShortJa(dateStr: string, base: string = tonightDateJST()): string {
  const [tonight, tomorrow] = nextNDatesJST(2, base);
  if (dateStr === tonight) return "今日";
  if (dateStr === tomorrow) return "明日";
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
}
