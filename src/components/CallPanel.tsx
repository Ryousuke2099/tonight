"use client";

import { useEffect, useRef } from "react";
import Avatar from "@/components/Avatar";
import type { UseCall } from "@/lib/webrtc/useCall";

function mmss(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * マッチカードから使う通話 UI。`useCall` のインスタンスを受け取り、phase に
 * 応じて発信中 / 着信中 / 通話中 / 終了 のシートを下部に表示する。
 * phase === "idle" のときは何も描画しない(発信ボタンは MatchCard 側にある)。
 */
export default function CallPanel({
  call,
  peerName,
  peerAvatarUrl,
}: {
  call: UseCall;
  peerName: string;
  peerAvatarUrl: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  if (call.phase === "idle") return null;

  const statusText: Record<Exclude<UseCall["phase"], "idle">, string> = {
    calling: "呼び出し中…",
    incoming: "着信中",
    connecting: "接続中…",
    connected: mmss(call.elapsed),
    ended: "通話を終了しました",
    failed: call.error ?? "通話できませんでした",
  };

  const terminal = call.phase === "ended" || call.phase === "failed";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm rounded-3xl bg-card shadow-2xl border border-accent/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar src={peerAvatarUrl} name={peerName} size={44} />
          <div className="min-w-0">
            <p className="text-moon font-medium truncate">{peerName}さん</p>
            <p className="text-sm text-moon/50 tabular-nums">
              {statusText[call.phase]}
            </p>
          </div>
          {call.phase === "connected" && (
            <span className="ml-auto flex h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
          )}
        </div>

        {call.error && !terminal && (
          <p className="text-xs text-ember">{call.error}</p>
        )}

        <audio ref={audioRef} autoPlay />

        <div className="flex gap-2">
          {call.phase === "incoming" && (
            <>
              <button
                onClick={call.decline}
                className="flex-1 rounded-xl bg-white/5 text-moon/70 text-sm font-medium py-3"
              >
                拒否
              </button>
              <button
                onClick={call.accept}
                className="flex-1 rounded-xl bg-accent text-night text-sm font-medium py-3"
              >
                応答する
              </button>
            </>
          )}

          {(call.phase === "calling" || call.phase === "connecting") && (
            <button
              onClick={call.hangup}
              className="flex-1 rounded-xl bg-ember/90 text-night text-sm font-medium py-3"
            >
              キャンセル
            </button>
          )}

          {call.phase === "connected" && (
            <>
              <button
                onClick={call.toggleMute}
                className={[
                  "flex-1 rounded-xl text-sm font-medium py-3",
                  call.muted
                    ? "bg-accent text-night"
                    : "bg-white/5 text-moon/70",
                ].join(" ")}
              >
                {call.muted ? "ミュート中" : "ミュート"}
              </button>
              <button
                onClick={call.hangup}
                className="flex-1 rounded-xl bg-ember/90 text-night text-sm font-medium py-3"
              >
                通話を切る
              </button>
            </>
          )}

          {terminal && (
            <button
              onClick={call.reset}
              className="flex-1 rounded-xl bg-white/5 text-moon/70 text-sm font-medium py-3"
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
