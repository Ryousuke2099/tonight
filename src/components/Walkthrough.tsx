"use client";

import { useRef, useState } from "react";

const SLIDES = [
  { icon: "🔒", text: "話したいと思ったことは、相手が同じ気持ちの時だけ伝わります" },
  { icon: "🕰️", text: "お互いが選んだ時間が重なった時だけ、そっと知らせます" },
  { icon: "🤝", text: "新しい出会いではなく、今いる友達ともっと話すためのアプリです" },
  { icon: "✨", text: "使い方: 日時を選ぶ → 友達を選ぶ → マッチを待つ" },
];

/** Swipeable slide-by-slide intro, used instead of a wall of text on the
 * landing page — one idea per screen, native scroll-snap swipe (no JS
 * carousel library needed). */
export default function Walkthrough() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(SLIDES.length - 1, Math.max(0, index)));
  }

  return (
    <div className="w-full space-y-3">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none" }}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl bg-card/60 [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="shrink-0 w-full snap-center p-6 flex flex-col items-center gap-3 text-center"
          >
            <span className="text-3xl">{s.icon}</span>
            <p className="text-sm text-moon/70 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={[
              "h-1.5 rounded-full transition-all",
              i === active ? "w-4 bg-accent" : "w-1.5 bg-moon/20",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
