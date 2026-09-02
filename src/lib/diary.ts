/**
 * 交換日記モードA（面識のない相手）の期間・往復回数のデフォルト値。
 * ピッチデッキ検討時点 (claude/woolink-pitch-deck-notes.md) で「決まり次第
 * 反映」と保留していた数値 — ハッカソンデモ用の仮値。正式決定後はここだけ
 * 差し替えればよい。
 */
export const MODE_A_WINDOW_DAYS = 7;
export const MODE_A_MAX_EXCHANGES = 5;

/** matches/diary_rooms と同じ「辞書順の小さい方を先」の正規化。 */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
