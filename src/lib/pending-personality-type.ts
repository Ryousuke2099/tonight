/**
 * 対人スタイル診断はログイン不要で受けられる（匿名診断→交換日記→知人化→
 * 日調、という初対面導線の入口のため）。未ログインで結果を保存しようと
 * した場合は、ログイン後に profiles.personality_type へ書き込めるよう
 * localStorage に一時保存しておく。best-effort（HomeClient の
 * HOWTO_SEEN_KEY と同じ扱い）— 失敗しても診断結果自体は画面に表示済み。
 */
const KEY = "tonight_pending_personality_type";

export function setPendingPersonalityType(type: string) {
  try {
    localStorage.setItem(KEY, type);
  } catch {
    // best-effort only
  }
}

export function takePendingPersonalityType(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    if (value) localStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
