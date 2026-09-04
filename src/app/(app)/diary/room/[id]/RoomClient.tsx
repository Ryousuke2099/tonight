"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { DIARY_PROMPTS } from "@/lib/diary-prompts";
import type { DiaryEntry, DiaryRoomWithPartner } from "@/types/db";

export default function RoomClient({ roomId, meId }: { roomId: string; meId: string }) {
  const [room, setRoom] = useState<DiaryRoomWithPartner | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [settingInterest, setSettingInterest] = useState(false);
  const [error, setError] = useState("");
  const [becameFriends, setBecameFriends] = useState(false);

  async function load() {
    const res = await fetch(`/api/diary/rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      setRoom(data.room);
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 期限切れ（時間経過）の判定はサーバー側（/api/diary/rooms/[id]/entries が
  // 409 を返す）が正とする。ここでは往復回数の上限だけを見て、送信欄を
  // 事前に畳んでおく — Date.now() を render 中に呼ぶ副作用を避けるため。
  const atLimit = !!room && room.mode === "a" && room.max_exchanges !== null && room.exchange_count >= room.max_exchanges;

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/diary/rooms/${roomId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, promptId }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error || "送信できませんでした");
      return;
    }
    setBody("");
    setPromptId(null);
    await load();
  }

  async function toggleInterest() {
    if (!room) return;
    setSettingInterest(true);
    const res = await fetch(`/api/diary/rooms/${roomId}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interested: !room.my_interest }),
    });
    const data = await res.json().catch(() => ({}));
    setSettingInterest(false);
    if (res.ok) {
      setRoom(data.room);
      if (data.becameFriends) setBecameFriends(true);
    }
  }

  if (loading || !room) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-moon/40 text-sm">読み込み中…</p>
      </main>
    );
  }

  const partnerLabel = room.mode === "a" && !room.converted_to_friend_at ? "匿名の相手" : room.partner.name;

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-5 pt-6 pb-3 space-y-2 border-b border-white/5">
        <Link href="/diary" className="text-xs text-moon/40 hover:text-moon/70">
          ← 交換日記
        </Link>
        <div className="flex items-center gap-3">
          <Avatar
            src={room.mode === "a" && !room.converted_to_friend_at ? null : room.partner.avatar_url}
            name={partnerLabel}
            size={36}
          />
          <div>
            <p className="text-sm text-moon font-medium">{partnerLabel}</p>
            <p className="text-xs text-moon/40">
              {room.mode === "a"
                ? `${room.exchange_count}${room.max_exchanges ? ` / ${room.max_exchanges}` : ""}往復${room.converted_to_friend_at ? "・知人化済み" : ""}`
                : "友達・無制限"}
            </p>
          </div>
        </div>

        {becameFriends && (
          <p className="text-xs text-accent bg-accent-soft rounded-lg px-3 py-2">
            お互いに「続けたい」が揃ったので、知人になりました 🎉 これからはTonightで通話調整もできます。
          </p>
        )}

        {room.mode === "a" && !room.converted_to_friend_at && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-moon/40">
              {atLimit ? "上限に達しました。" : "期間・往復の上限に達すると自動的に終了します。"}
              知人として続けたいなら、お互いに指定を。
            </p>
            <button
              onClick={toggleInterest}
              disabled={settingInterest}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                room.my_interest ? "bg-accent text-night" : "bg-white/10 text-moon/70 hover:bg-white/15",
              ].join(" ")}
            >
              {room.my_interest ? "続けたい ✓" : "続けたい"}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-moon/30 text-center pt-10">まだ日記はありません。最初の一通を書いてみましょう。</p>
        )}
        {entries.map((e) => {
          const mine = e.author_id === meId;
          return (
            <div key={e.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[80%] rounded-2xl px-4 py-3 space-y-1",
                  mine ? "bg-accent text-night" : "bg-card text-moon",
                ].join(" ")}
              >
                {e.prompt && (
                  <p className={mine ? "text-xs text-night/60" : "text-xs text-moon/40"}>お題: {e.prompt}</p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{e.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!atLimit || room.mode === "b" ? (
        <div className="px-5 pb-6 pt-2 border-t border-white/5 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {DIARY_PROMPTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPromptId(promptId === p.id ? null : p.id)}
                className={[
                  "shrink-0 rounded-full px-3 py-1 text-xs",
                  promptId === p.id ? "bg-accent text-night" : "bg-white/5 text-moon/50 hover:bg-white/10",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="今日のことを書いてみる"
              rows={2}
              className="flex-1 resize-none rounded-xl bg-card border border-white/10 px-3 py-2.5 text-sm text-moon placeholder:text-moon/30 outline-none focus:border-accent/50"
            />
            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="rounded-xl bg-accent text-night font-medium px-4 py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              {sending ? "…" : "送る"}
            </button>
          </div>
          {error && <p className="text-xs text-ember">{error}</p>}
        </div>
      ) : (
        <div className="px-5 pb-6 pt-2 border-t border-white/5">
          <p className="text-xs text-moon/40 text-center">
            この交換日記は上限に達しました。お互いに「続けたい」を選ぶと知人として続けられます。
          </p>
        </div>
      )}
    </main>
  );
}
