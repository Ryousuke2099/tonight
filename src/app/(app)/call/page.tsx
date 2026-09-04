"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nextNDatesJST, formatDateJa } from "@/lib/date";
import "./call.css";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export default function CallSchedulePage() {
  const router = useRouter();
  const dates = useMemo(() => nextNDatesJST(7), []);
  const today = dates[0];

  const [selected, setSelected] = useState(today);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/intent/dates?dates=${dates.join(",")}`);
      if (res.ok) {
        const { dates: saved } = await res.json();
        setSavedDates(new Set<string>(saved ?? []));
      }
    })();
  }, [dates]);

  const selectedHasPlan = savedDates.has(selected);

  return (
    <main className="call-page">
      <div className="call-phone">
        <section className="call-content">
          <section className="call-date-picker">
            <div className="call-date-picker-header">{formatDateJa(selected)}</div>

            <div className="call-date-picker-row">
              {dates.map((d) => {
                const [, m, dd] = d.split("-").map(Number);
                const weekday = WEEKDAY_JA[new Date(d + "T00:00:00").getDay()];
                const isToday = d === today;
                const isSelected = d === selected;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`call-date-chip${savedDates.has(d) ? " has-schedule" : ""}${
                      isSelected ? " is-selected" : ""
                    }`}
                    onClick={() => setSelected(d)}
                  >
                    <span className="call-date-caption">{isToday ? "今日" : `${m}月`}</span>
                    <span className="call-date-num">{dd}</span>
                    <span className="call-date-weekday">{weekday}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="call-schedule-card">
            <h1>{formatDateJa(selected)}　話せる時間</h1>
            <p className="call-schedule-empty">
              {selectedHasPlan
                ? "この日の予定は登録済みです。次に進むと相手・時間を選び直せます。"
                : "次の画面で、誰と・いつ話したいかを選びます。"}
            </p>
          </section>

          <div className="call-footer-actions">
            <Link href={`/call/who?date=${selected}`} className="call-next-btn">
              次へ
            </Link>

            <div className="call-back-btn-wrap">
              <button type="button" className="call-back-btn" onClick={() => router.push("/home")}>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path
                    d="M15 5l-7 7 7 7"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                戻る
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
