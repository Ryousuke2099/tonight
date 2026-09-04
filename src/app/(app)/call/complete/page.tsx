"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MatchCard from "@/components/MatchCard";
import { formatDateJa } from "@/lib/date";
import type { MatchWithFriend } from "@/types/db";
import "./complete.css";

type SaveState =
  | { status: "saving" }
  | { status: "done"; matches: MatchWithFriend[] }
  | { status: "error"; message: string };

function CallCompleteContent() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date");
  const who = searchParams.get("who");
  const friend = searchParams.get("friend");
  const slotsParam = searchParams.get("slots");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const [state, setState] = useState<SaveState>({ status: "saving" });
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    (async () => {
      const slots = (slotsParam ?? "")
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 0);

      if (!date || slots.length === 0) {
        setState({ status: "error", message: "予定の内容が読み取れませんでした。" });
        return;
      }

      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mode: who === "friend" ? "selected" : "anyone",
          targetIds: friend ? [friend] : [],
          slots,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ status: "error", message: body.error ?? "予定の保存に失敗しました。" });
        return;
      }
      const { matches } = await res.json();
      setState({ status: "done", matches: matches ?? [] });
    })();
  }, [date, who, friend, slotsParam]);

  const dateLabel = date ? formatDateJa(date) : "";
  const timeLabel = `${start ?? "00:00"}〜${end ?? "00:00"}`;

  return (
    <main className="complete-page">
      <div className="complete-phone">
        <section className="complete-content">
          <div className="complete-message">
            <p className="complete-datetime">
              {dateLabel}
              <br />
              {timeLabel}
            </p>
            <p className="complete-caption">
              {state.status === "saving" ? "を登録中…" : "に設定しました"}
            </p>
          </div>

          {state.status === "error" && (
            <p style={{ color: "#ffb4b4", fontSize: 13, textAlign: "center", margin: "0 20px" }}>
              {state.message}
            </p>
          )}

          {state.status === "done" && state.matches.length > 0 && (
            <div style={{ padding: "4px 16px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ color: "#eef0fb", fontSize: 14, fontWeight: 700, textAlign: "center", margin: 0 }}>
                両想いになりました
              </p>
              {state.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          )}

          {state.status === "done" && state.matches.length === 0 && (
            <p style={{ color: "rgba(238,240,251,0.6)", fontSize: 13, textAlign: "center", margin: "0 24px" }}>
              相手も同じ時間に「話したい」を選んだら、ここで通話できるようになります。
            </p>
          )}

          <div className="complete-footer-actions">
            <Link href="/home" className="complete-home-btn">
              ホームへ戻る
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CallCompletePage() {
  return (
    <Suspense fallback={null}>
      <CallCompleteContent />
    </Suspense>
  );
}
