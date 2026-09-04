"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;

export default function QueueClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "waiting" | "matched" | "left">("joining");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function tryMatch() {
      const res = await fetch("/api/diary/queue", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.matched) {
        setStatus("matched");
        if (timerRef.current) clearInterval(timerRef.current);
        router.push(`/diary/room/${data.roomId}`);
      } else {
        setStatus("waiting");
      }
    }

    (async () => {
      await tryMatch();
    })();
    timerRef.current = setInterval(() => {
      tryMatch();
    }, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function leave() {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("left");
    await fetch("/api/diary/queue", { method: "DELETE" });
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-6">
      {status === "left" ? (
        <>
          <p className="text-3xl">👋</p>
          <p className="text-sm text-moon/60">待機をやめました</p>
          <Link href="/diary" className="text-xs text-accent/80 underline underline-offset-4">
            交換日記に戻る
          </Link>
        </>
      ) : (
        <>
          <p className="text-3xl animate-pulse">🌱</p>
          <div className="space-y-1">
            <h1 className="text-lg font-medium text-moon">お相手を探しています…</h1>
            <p className="text-sm text-moon/50">見つかり次第、自動的にはじまります</p>
          </div>
          <p className="text-xs text-moon/30 max-w-xs">
            誰と当たったかは、途中で明かされません。期間内にお互いが「続けたい」を選ぶと知人になれます。
          </p>
          <button onClick={leave} className="text-xs text-moon/40 underline underline-offset-4">
            待機をやめる
          </button>
        </>
      )}
    </main>
  );
}
