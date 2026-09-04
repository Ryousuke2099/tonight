"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buildCallQuery } from "../callQuery";
import "./time.css";

const START_HOUR = 20;
const END_HOUR = 26; // 26:00 = 翌 2:00 として表示
const SLOT_COUNT = (END_HOUR - START_HOUR) * 2; // = 12 (tonight の SlotIndex と一致: 0 = 20:00, 30分刻み)

function formatSlotTime(index: number) {
  const hour = START_HOUR + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour % 24).padStart(2, "0")}:${minute}`;
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 40 40" width="22" height="22">
      <circle cx="20" cy="15" r="7" fill="#eef0fb" />
      <path
        d="M6 34c0-8 6-13 14-13s14 5 14 13"
        fill="none"
        stroke="#eef0fb"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CallTimeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date");
  const who = searchParams.get("who");
  const friend = searchParams.get("friend");
  const fname = searchParams.get("fname");

  const [selected, setSelected] = useState<boolean[]>(() => Array(SLOT_COUNT).fill(false));

  // 既にこの日の予定があれば読み込んでプリセットする
  useEffect(() => {
    if (!date) return;
    (async () => {
      const res = await fetch(`/api/intent?date=${date}`);
      if (!res.ok) return;
      const { intent } = await res.json();
      if (intent?.slots?.length) {
        setSelected(() => {
          const next = Array(SLOT_COUNT).fill(false);
          for (const s of intent.slots as number[]) if (s >= 0 && s < SLOT_COUNT) next[s] = true;
          return next;
        });
      }
    })();
  }, [date]);

  const draggingRef = useRef(false);
  const dragValueRef = useRef(true);

  useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    window.addEventListener("touchcancel", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
      window.removeEventListener("touchcancel", stop);
    };
  }, []);

  const setSlot = (index: number, value: boolean) => {
    setSelected((prev) => {
      if (prev[index] === value) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleStart = (index: number) => {
    draggingRef.current = true;
    dragValueRef.current = !selected[index];
    setSlot(index, dragValueRef.current);
  };

  const handleEnter = (index: number) => {
    if (!draggingRef.current) return;
    setSlot(index, dragValueRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el?.closest<HTMLElement>("[data-index]");
    if (target) handleEnter(Number(target.dataset.index));
  };

  const selectedIndices = selected
    .map((isOn, i) => (isOn ? i : null))
    .filter((i): i is number => i !== null);

  const hasSelection = selectedIndices.length > 0;
  const rangeStart = hasSelection ? formatSlotTime(Math.min(...selectedIndices)) : null;
  const rangeEnd = hasSelection ? formatSlotTime(Math.max(...selectedIndices) + 1) : null;

  return (
    <main className="time-page">
      <div className="time-phone">
        <section className="time-content">
          <div className="time-scroll-area">
            <div className="time-selected-contact">
              <span className="time-avatar avatar-5">
                <PersonIcon />
              </span>
              <span className="time-contact-main">
                <span className="time-contact-name">
                  {who === "friend" ? fname ?? "友達" : "友達なら誰でも"}
                </span>
              </span>
              <span className="time-radio-dot is-checked" aria-hidden="true" />
            </div>

            <div className="time-picker-header">
              <span className="time-picker-title">話せる時間を選ぶ</span>
              <span className="time-picker-status">
                {hasSelection ? `${selectedIndices.length}件選択中` : "未選択"}
              </span>
            </div>

            <div className="time-grid" onTouchMove={handleTouchMove}>
              {Array.from({ length: SLOT_COUNT }, (_, index) => {
                const hour = START_HOUR + Math.floor(index / 2);
                const label = index % 2 === 0 ? `${String(hour % 24).padStart(2, "0")}:00` : "";
                return (
                  <button
                    key={index}
                    type="button"
                    data-index={index}
                    className={`time-row${selected[index] ? " is-selected" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleStart(index);
                    }}
                    onMouseEnter={() => handleEnter(index)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleStart(index);
                    }}
                  >
                    <span className="time-label">{label}</span>
                    <span className="time-bar" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="time-footer-actions">
            <Link
              className={`time-next-btn${hasSelection ? "" : " is-disabled"}`}
              href={
                hasSelection
                  ? `/call/complete${buildCallQuery({
                      date,
                      who,
                      friend,
                      fname,
                      slots: selectedIndices.join(","),
                      start: rangeStart,
                      end: rangeEnd,
                    })}`
                  : "#"
              }
              aria-disabled={!hasSelection}
            >
              次へ
            </Link>

            <div className="time-back-btn-wrap">
              <button type="button" className="time-back-btn" onClick={() => router.back()}>
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

export default function CallTimePage() {
  return (
    <Suspense fallback={null}>
      <CallTimeContent />
    </Suspense>
  );
}
