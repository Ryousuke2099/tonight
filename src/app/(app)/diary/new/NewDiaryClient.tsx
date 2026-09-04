"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import type { FriendOption } from "@/components/FriendSelector";

export default function NewDiaryClient() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const { friends } = await res.json();
        setFriends(friends ?? []);
      }
      setLoading(false);
    })();
  }, []);

  async function start(friendId: string) {
    setStarting(friendId);
    setError("");
    const res = await fetch("/api/diary/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "開始できませんでした");
      setStarting(null);
      return;
    }
    router.push(`/diary/room/${data.roomId}`);
  }

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-6 pb-10">
      <header className="mb-6">
        <Link href="/diary" className="text-xs text-moon/40 hover:text-moon/70">
          ← 交換日記
        </Link>
        <h1 className="text-lg font-medium text-moon mt-2">誰と交換日記をはじめる？</h1>
        <p className="text-xs text-moon/40 mt-1">友達となら、無制限にいつでも続けられます。</p>
      </header>

      {loading && <p className="text-sm text-moon/40">読み込み中…</p>}

      {!loading && friends.length === 0 && (
        <p className="text-sm text-moon/40">
          まだ友達がいません。Tonightのホームから友達を追加してください。
        </p>
      )}

      <div className="space-y-2">
        {friends.map((f) => (
          <button
            key={f.id}
            onClick={() => start(f.id)}
            disabled={starting !== null}
            className="w-full flex items-center gap-3 rounded-2xl bg-card hover:bg-card-hover p-3 text-left disabled:opacity-50"
          >
            <Avatar src={f.avatar_url} name={f.name} size={40} />
            <span className="flex-1 text-sm text-moon font-medium">{f.name}</span>
            {starting === f.id && <span className="text-xs text-moon/40">開始中…</span>}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-ember mt-4">{error}</p>}
    </main>
  );
}
