import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 通話(WebRTC)用の ICE サーバー設定を返す。
 *
 * STUN は Google の公開サーバー。TURN を使う場合は環境変数で設定する
 * (認証情報をクライアントバンドルに含めないため、ここでサーバーから渡す):
 *   TURN_URLS        カンマ区切りの turn: / turns: URL
 *   TURN_USERNAME    TURN ユーザー名
 *   TURN_CREDENTIAL  TURN クレデンシャル
 *
 * MVP は STUN のみで動く(同一ネットワーク・デモ用途なら十分)。対称 NAT や
 * 厳しいモバイル回線の相手とも安定して繋ぐには TURN が必要。恒久運用では
 * 期限付きクレデンシャル(HMAC)に置き換えることを推奨。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const iceServers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const turnUrls = process.env.TURN_URLS;
  if (turnUrls) {
    const urls = turnUrls
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      iceServers.push({
        urls,
        username: process.env.TURN_USERNAME ?? "",
        credential: process.env.TURN_CREDENTIAL ?? "",
      });
    }
  }

  return NextResponse.json(
    { iceServers },
    { headers: { "cache-control": "no-store" } }
  );
}
