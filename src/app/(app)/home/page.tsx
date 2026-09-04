"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MatchCard from "@/components/MatchCard";
import { nextNDatesJST } from "@/lib/date";
import type { MatchWithFriend } from "@/types/db";
import "./home.css";

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const dates = useMemo(() => nextNDatesJST(7), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchWithFriend[]>([]);

  const refreshMatches = useCallback(async () => {
    const results = await Promise.all(
      dates.map((d) =>
        fetch(`/api/matches?date=${d}`)
          .then((r) => (r.ok ? r.json() : { matches: [] }))
          .catch(() => ({ matches: [] }))
      )
    );
    const all = results.flatMap((r) => (r.matches ?? []) as MatchWithFriend[]);
    // 同じ相手・同じ日の重複は除く
    const seen = new Set<string>();
    setMatches(all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))));
  }, [dates]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const fRes = await fetch("/api/friends");
      if (fRes.ok) {
        const { friends } = await fRes.json();
        setFriendCount((friends ?? []).length);
      }
      await refreshMatches();
    })();
  }, [supabase, refreshMatches]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`home-matches-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `user_a=eq.${userId}` },
        () => refreshMatches()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `user_b=eq.${userId}` },
        () => refreshMatches()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, refreshMatches]);

  return (
    <main className="woolink-home">
      <div className="phone">
        <section className="content">
          <section className="friend-card">
            <h1>友達一覧</h1>
            <p>
              {friendCount === null
                ? "読み込み中…"
                : friendCount === 0
                ? "まだ友達がいません。両思い通話の画面からメールアドレスで追加できます。"
                : `${friendCount}人の友達とつながっています。`}
            </p>
          </section>

          {matches.length > 0 && (
            <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#cfd3f0", textAlign: "center" }}>
                🌙 話せる相手
              </p>
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </section>
          )}

          <section className="actions">
            <Link className="action-tile diary" href="/diary">
              <span className="badge" aria-hidden="true" />
              <svg className="tile-icon" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
                <rect x="12" y="8" width="24" height="32" rx="3" fill="#fbfaf6" />
                <rect x="9" y="10" width="24" height="32" rx="3" fill="#ffffff" stroke="#dcd8cc" strokeWidth="1" />
                <line x1="14" y1="17" x2="28" y2="17" stroke="#c9c4b4" strokeWidth="1.4" />
                <line x1="14" y1="22" x2="28" y2="22" stroke="#c9c4b4" strokeWidth="1.4" />
                <line x1="14" y1="27" x2="24" y2="27" stroke="#c9c4b4" strokeWidth="1.4" />
              </svg>
              <span className="tile-label">交換日記</span>
            </Link>

            <Link className="action-tile call" href="/call">
              <svg className="tile-icon" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
                <path
                  d="M17 11l6 7-4 4c2.2 4.5 5.5 7.8 10 10l4-4 7 6c-1.6 4.2-5.9 5.9-9.8 4.5-8.8-3.2-15.5-9.9-18.7-18.7C10.1 15.9 12.8 12.6 17 11Z"
                  fill="none"
                  stroke="#fbfaf6"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="tile-label">両思い通話</span>
            </Link>
          </section>
        </section>

        <footer className="mascot-row">
          <Image className="mascot" src="/home/guide-sheep.svg" alt="ガイド羊" width={120} height={120} />
          <Link className="guide-bubble" href="/help">
            ガイド
          </Link>
        </footer>
      </div>
    </main>
  );
}
