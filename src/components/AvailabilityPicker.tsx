"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { allSlotIndices, formatSlotTime, longestContiguousRun, formatRange } from "@/lib/slots";
import type { SlotIndex } from "@/types/db";

interface AvailabilityPickerProps {
  value: SlotIndex[];
  onChange: (slots: SlotIndex[]) => void;
}

/**
 * A When2meet-style vertical slot picker for the 20:00 -> 26:00 (02:00)
 * night window, 30-minute steps. Tap a single slot, or press-and-drag
 * across several to select (or deselect, if the drag starts on an already
 * selected slot) a range in one gesture. Built for touch first: the whole
 * gesture runs off pointer capture + elementFromPoint so a finger dragging
 * across rows keeps working even though it physically leaves the row it
 * started on.
 */
export default function AvailabilityPicker({ value, onChange }: AvailabilityPickerProps) {
  const slots = useMemo(() => allSlotIndices(), []);
  const selected = useMemo(() => new Set(value), [value]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragModeRef = useRef<"select" | "deselect" | null>(null);
  const touchedRef = useRef<Set<number>>(new Set());
  const [, forceRerender] = useState(0);

  const applyToIndex = useCallback(
    (index: number, mode: "select" | "deselect") => {
      if (touchedRef.current.has(index)) return;
      touchedRef.current.add(index);
      const next = new Set(selected);
      if (mode === "select") next.add(index);
      else next.delete(index);
      onChange(Array.from(next).sort((a, b) => a - b));
    },
    [selected, onChange]
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    const mode: "select" | "deselect" = selected.has(index) ? "deselect" : "select";
    dragModeRef.current = mode;
    touchedRef.current = new Set();
    applyToIndex(index, mode);
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragModeRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = el?.closest<HTMLElement>("[data-slot-index]");
    if (!row) return;
    const index = Number(row.dataset.slotIndex);
    applyToIndex(index, dragModeRef.current);
  }

  function endDrag() {
    dragModeRef.current = null;
    touchedRef.current = new Set();
    forceRerender((n) => n + 1);
  }

  const run = longestContiguousRun(value);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-moon/60">話せる時間を選ぶ</p>
        <p className="text-sm font-medium text-accent min-h-5">
          {run ? formatRange(run.start, run.end) : "未選択"}
        </p>
      </div>

      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          // only end if no button/touch is active (avoid killing drag on
          // brief boundary flicker) — pointerup/cancel handle the real end
          if (e.buttons === 0 && e.pointerType !== "touch") endDrag();
        }}
        className="no-select rounded-2xl bg-card overflow-hidden border border-white/5"
      >
        {slots.map((index) => {
          const isSelected = selected.has(index);
          const isHourMark = index % 2 === 0;
          return (
            <div
              key={index}
              data-slot-index={index}
              onPointerDown={(e) => handlePointerDown(e, index)}
              className={[
                "flex items-center gap-3 px-4 h-10 cursor-pointer transition-colors select-none",
                isHourMark ? "border-t border-white/10" : "border-t border-white/[0.03]",
                isSelected ? "bg-accent-soft" : "hover:bg-white/[0.03]",
              ].join(" ")}
            >
              <span
                className={[
                  "w-12 text-xs tabular-nums shrink-0",
                  isHourMark ? "text-moon/50" : "text-transparent",
                ].join(" ")}
              >
                {formatSlotTime(index)}
              </span>
              <div
                className={[
                  "h-6 flex-1 rounded-md transition-colors",
                  isSelected ? "bg-accent" : "bg-white/[0.04]",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-moon/40 text-center">タップ、またはドラッグで選択</p>
    </div>
  );
}
