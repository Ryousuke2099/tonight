import { SLOT_COUNT, SLOT_START_HOUR, type SlotIndex } from "@/types/db";

/** Format a slot index as "HH:MM", rolling past 24:00 into 25:xx / 26:00 style
 * display (common in Japanese late-night listings) rather than wrapping to 00:xx. */
export function formatSlotTime(slot: SlotIndex): string {
  const totalMinutes = SLOT_START_HOUR * 60 + slot * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour}:${minute.toString().padStart(2, "0")}`;
}

/** slot index -> real wall-clock "HH:MM" (mod 24), for places that need the
 * actual clock time rather than the late-night display convention. */
export function formatSlotClock(slot: SlotIndex): string {
  const totalMinutes = SLOT_START_HOUR * 60 + slot * 30;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

/** A half-hour slot index represents [slot, slot+1) i.e. its start and the
 * start of the next slot. A contiguous run of slots [start..end] (inclusive,
 * end = last selected slot) covers formatSlotTime(start) - formatSlotTime(end+1). */
export function formatRange(start: SlotIndex, end: SlotIndex): string {
  return `${formatSlotTime(start)}〜${formatSlotTime(end + 1)}`;
}

export function allSlotIndices(): SlotIndex[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => i);
}

/** Find the longest contiguous run within a set of slot indices. Returns
 * null if the set is empty. Ties broken by earliest run. */
export function longestContiguousRun(
  slots: SlotIndex[]
): { start: SlotIndex; end: SlotIndex } | null {
  if (slots.length === 0) return null;
  const sorted = [...new Set(slots)].sort((a, b) => a - b);
  let bestStart = sorted[0];
  let bestEnd = sorted[0];
  let curStart = sorted[0];
  let curEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === curEnd + 1) {
      curEnd = sorted[i];
    } else {
      if (curEnd - curStart > bestEnd - bestStart) {
        bestStart = curStart;
        bestEnd = curEnd;
      }
      curStart = sorted[i];
      curEnd = sorted[i];
    }
  }
  if (curEnd - curStart > bestEnd - bestStart) {
    bestStart = curStart;
    bestEnd = curEnd;
  }
  return { start: bestStart, end: bestEnd };
}

export function intersectSlots(a: SlotIndex[], b: SlotIndex[]): SlotIndex[] {
  const setB = new Set(b);
  return a.filter((s) => setB.has(s));
}

/** Human summary like "22:00〜24:30" for a raw (possibly non-contiguous) slot
 * selection, used on the Waiting screen. Falls back to slot count if the
 * selection is fragmented. */
export function summarizeSlots(slots: SlotIndex[]): string {
  if (slots.length === 0) return "";
  const run = longestContiguousRun(slots);
  if (!run) return "";
  const covered = run.end - run.start + 1;
  if (covered === slots.length) {
    return formatRange(run.start, run.end);
  }
  return `${formatRange(run.start, run.end)} など`;
}
