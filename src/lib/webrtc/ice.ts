// ICE サーバー設定の取得。TURN の認証情報をクライアントに直書きしないため、
// サーバーの /api/turn から受け取る。取得失敗時は Google の公開 STUN に
// フォールバックする(= デモや同一ネットワーク内なら TURN 無しでも繋がる)。

let cached: RTCIceServer[] | null = null;

const FALLBACK: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cached) return cached;
  try {
    const res = await fetch("/api/turn", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { iceServers?: RTCIceServer[] };
      if (json.iceServers && json.iceServers.length > 0) {
        cached = json.iceServers;
        return cached;
      }
    }
  } catch {
    // ネットワークエラー等 — フォールバックへ
  }
  cached = FALLBACK;
  return cached;
}
