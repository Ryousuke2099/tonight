"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { takePendingPersonalityType } from "@/lib/pending-personality-type";
import type { DiaryRoomWithPartner } from "@/types/db";

export default function DiaryClient() {
  const [rooms, setRooms] = useState<DiaryRoomWithPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 診断結果→ログインを経由してここに来た場合、保留していたタイプを保存する。
      const pending = takePendingPersonalityType();
      if (pending) {
        await fetch("/api/profile/personality-type", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: pending }),
        });
      }
      const res = await fetch("/api/diary/rooms");
      if (res.ok) {
        const { rooms } = await res.json();
        setRooms(rooms ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const modeB = rooms.filter((r) => r.mode === "b");
  const modeA = rooms.filter((r) => r.mode === "a");

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-moon/40 text-sm">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-moon">交換日記</h1>
          <p className="text-xs text-moon/40 mt-0.5">1日1往復で、ゆっくり関係を育てる</p>
        </div>
        <Link href="/home" className="text-xs text-moon/40 hover:text-moon/70">
          ← Tonightへ
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-8">
        <Link
          href="/diary/new"
          className="rounded-2xl bg-card hover:bg-card-hover p-4 text-left space-y-1"
        >
          <span className="text-xl">👥</span>
          <span className="block text-sm text-moon font-medium">友達とはじめる</span>
          <span className="block text-xs text-moon/40">無制限・任意</span>
        </Link>
        <Link
          href="/diary/queue"
          className="rounded-2xl bg-card hover:bg-card-hover p-4 text-left space-y-1"
        >
          <span className="text-xl">🌱</span>
          <span className="block text-sm text-moon font-medium">知らない人とはじめる</span>
          <span className="block text-xs text-moon/40">期間限定・匿名</span>
        </Link>
      </div>

      {rooms.length === 0 && (
        <p className="text-sm text-moon/40 text-center pt-8">
          まだ交換日記はありません。上のどちらかから始めてみてください。
        </p>
      )}

      {modeA.length > 0 && (
        <section className="space-y-2 mb-6">
          <p className="text-xs text-moon/40 uppercase tracking-wide px-1">知らない人と（期間限定）</p>
          <RoomList rooms={modeA} />
        </section>
      )}

      {modeB.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs text-moon/40 uppercase tracking-wide px-1">友達と（無制限）</p>
          <RoomList rooms={modeB} />
        </section>
      )}
    </main>
  );
}

function RoomList({ rooms }: { rooms: DiaryRoomWithPartner[] }) {
  return (
    <div className="space-y-2">
      {rooms.map((r) => (
        <Link
          key={r.id}
          href={`/diary/room/${r.id}`}
          className="flex items-center gap-3 rounded-2xl bg-card hover:bg-card-hover p-3"
        >
          <Avatar src={r.partner.avatar_url} name={r.mode === "a" ? "?" : r.partner.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-moon font-medium truncate">
              {r.mode === "a" ? "匿名の相手" : r.partner.name}
              {r.converted_to_friend_at && <span className="ml-1.5 text-xs text-accent">知人化済み</span>}
            </p>
            <p className="text-xs text-moon/40">
              {r.mode === "a" ? `${r.exchange_count}${r.max_exchanges ? ` / ${r.max_exchanges}` : ""}往復` : `${r.exchange_count}往復`}
              {r.partner_interest && !r.converted_to_friend_at && "・相手が続けたいと言っています"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
