"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import CallPanel from "@/components/CallPanel";
import { formatRange } from "@/lib/slots";
import { lineShareUrl, copyText } from "@/lib/share";
import { useCall } from "@/lib/webrtc/useCall";
import type { MatchWithFriend } from "@/types/db";

export default function MatchCard({ match }: { match: MatchWithFriend }) {
  const [copied, setCopied] = useState(false);
  const range = formatRange(match.overlap_start, match.overlap_end);
  const message = `今夜 ${range} なら話せそう！電話する？ 🌙`;

  // どちらの参加者が「自分」かは match 行から一意に決まる(friend が相手なので、
  // user_a / user_b のうち friend.id でない方が自分)。
  const meId = match.user_a === match.friend.id ? match.user_b : match.user_a;
  // デモログインしたユーザー(Takumi/Haru 等)も is_demo だが実体はいるので
  // 通話可能。自動生成のサンプル相手を呼んだ場合は誰も出ないまま呼び出し
  // タイムアウトになるだけ(害はない)。
  const call = useCall({ matchId: match.id, meId, peerId: match.friend.id });

  return (
    <div className="rounded-2xl bg-card p-5 space-y-4 border border-accent/20">
      <div className="flex items-center gap-3">
        <Avatar src={match.friend.avatar_url} name={match.friend.name} size={48} />
        <div>
          <p className="text-xs text-accent">
            🌙 Match{match.preferred && <span className="ml-1.5 text-moon/50">⭐ 優先</span>}
          </p>
          <p className="text-moon font-medium">
            {match.friend.name}さんも今夜話したいみたい
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-night-deep/60 px-4 py-3 text-center">
        <p className="text-lg font-semibold text-moon tabular-nums">{range}</p>
        <p className="text-xs text-moon/50 mt-0.5">2人とも話せる時間</p>
      </div>

      {match.friend.is_demo && (
        <p className="text-xs text-moon/40 text-center -mt-2">
          🌙 これはTonightのサンプル相手です。実際の友達を招待すると、こんな風にマッチが届きます。
        </p>
      )}

      <button
        onClick={call.start}
        disabled={call.phase !== "idle"}
        className="w-full rounded-xl bg-accent text-night text-sm font-medium py-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {call.phase === "idle" ? "📞 通話する" : "通話中…"}
      </button>

      <div className="flex gap-2">
        <a
          href={lineShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center rounded-xl bg-[#06C755] text-white text-sm font-medium py-2.5 hover:brightness-105 transition"
        >
          LINEで連絡する
        </a>
        <button
          onClick={async () => {
            const ok = await copyText(message);
            setCopied(ok);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-xl bg-white/5 text-moon/80 text-sm px-4 py-2.5 hover:bg-white/10 transition"
        >
          {copied ? "コピー済み" : "コピー"}
        </button>
      </div>

      <CallPanel
        call={call}
        peerName={match.friend.name}
        peerAvatarUrl={match.friend.avatar_url}
      />
    </div>
  );
}
