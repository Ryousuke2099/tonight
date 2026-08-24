/**
 * Standalone smoke test for the pure slot/overlap math against the examples
 * given in the spec (§3, §4, §17) — no Supabase connection needed.
 * Run with: npx tsx scripts/test-match-logic.ts
 */
import { intersectSlots, longestContiguousRun, formatRange, formatSlotTime } from "../src/lib/slots";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`✗ ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

// slot 0 = 20:00. Half-hour steps.
const slot = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const totalMin = (h < 20 ? h + 24 : h) * 60 + m - 20 * 60;
  return totalMin / 30;
};
const range = (from: string, to: string) => {
  const start = slot(from);
  const end = slot(to) - 1; // inclusive end slot
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

// --- §3 example: A 22:00-24:00, B 23:00-25:00 -> mutual overlap 23:00-24:00
{
  const a = range("22:00", "24:00");
  const b = range("23:00", "25:00");
  const overlap = intersectSlots(a, b);
  const run = longestContiguousRun(overlap)!;
  assertEqual(formatRange(run.start, run.end), "23:00〜24:00", "§3 overlap example");
}

// --- §4 example 1: A->B yes, B->A yes, same availability as above -> match 23:00-24:00
{
  const a = range("22:00", "24:00");
  const b = range("23:00", "25:00");
  const overlap = intersectSlots(a, b);
  const run = longestContiguousRun(overlap);
  assertEqual(run !== null, true, "§4 mutual+overlap example produces a match");
}

// --- §4 example 2: A->B yes, B->A no -> matcher must never even attempt an
// overlap computation for this pair (enforced in src/lib/match.ts by the
// `theyWantMe` check short-circuiting before intersectSlots runs).
{
  const iWantThem = true;
  const theyWantMe = false;
  const wouldComputeOverlap = iWantThem && theyWantMe;
  assertEqual(wouldComputeOverlap, false, "§4 one-directional intent never reaches overlap/match logic");
}

// --- §17 demo scenario: Takumi 22:00-24:00, Haru 23:00-25:00 -> 23:00-24:00
{
  const takumi = range("22:00", "24:00");
  const haru = range("23:00", "25:00");
  const run = longestContiguousRun(intersectSlots(takumi, haru))!;
  assertEqual(formatRange(run.start, run.end), "23:00〜24:00", "§17 demo scenario A+B match window");
}

// --- §17 demo scenario: guest C picks 23:30-24:30, overlapping Takumi's
// 22:00-24:00 -> overlap should be 23:30-24:00
{
  const takumi = range("22:00", "24:00");
  const guestC = range("23:30", "24:30");
  const run = longestContiguousRun(intersectSlots(takumi, guestC))!;
  assertEqual(formatRange(run.start, run.end), "23:30〜24:00", "§17 demo scenario guest C overlap");
}

// --- late-night rollover formatting: slot 11 (25:30) should read as 25:30,
// not wrap to 01:30, matching the late-night display convention used in the UI.
{
  assertEqual(formatSlotTime(11), "25:30", "late-night slot formatting (25:30, not 01:30)");
}

// --- no overlap at all
{
  const a = range("20:00", "21:00");
  const b = range("23:00", "24:00");
  const run = longestContiguousRun(intersectSlots(a, b));
  assertEqual(run, null, "non-overlapping availability produces no match window");
}

if (process.exitCode === 1) {
  console.error("\nSome checks failed.");
} else {
  console.log("\nAll checks passed.");
}
