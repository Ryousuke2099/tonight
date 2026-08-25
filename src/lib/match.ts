import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { intersectSlots, longestContiguousRun } from "@/lib/slots";
import type { IntentMode, MatchWithFriend } from "@/types/db";

interface IntentRow {
  mode: IntentMode;
  targets: string[]; // target_user_id list, only meaningful when mode === 'selected'
}

/**
 * Recomputes matches for `userId` on `date` and upserts any newly-mutual,
 * overlapping pairs into `matches`. This is the ONLY function in the app
 * that reads another user's intent/availability — it always runs with the
 * service-role client, server-side, never reachable from a client request
 * without going through this exact flow (see /api/intent).
 *
 * Returns the up-to-date list of matches involving `userId` for that date.
 */
export async function recomputeMatchesForUser(
  admin: SupabaseClient,
  userId: string,
  date: string
): Promise<MatchWithFriend[]> {
  const me = await getIntentAndAvailability(admin, userId, date);
  if (!me) return getMatchesForUser(admin, userId, date);

  // 1. Build the candidate set.
  let candidateIds: string[] = [];
  if (me.intent.mode === "selected") {
    candidateIds = me.intent.targets;
  } else {
    const { data: friendships } = await admin
      .from("friendships")
      .select("friend_id")
      .eq("user_id", userId);
    const friendIds = (friendships ?? []).map((f) => f.friend_id as string);
    if (friendIds.length > 0) {
      const { data: intentsToday } = await admin
        .from("daily_intents")
        .select("user_id")
        .eq("date", date)
        .in("user_id", friendIds);
      candidateIds = (intentsToday ?? []).map((r) => r.user_id as string);
    }
  }

  // 2. Check mutual interest + overlap for each candidate, upsert matches.
  for (const candidateId of candidateIds) {
    if (candidateId === userId) continue;

    const candidate = await getIntentAndAvailability(admin, candidateId, date);
    if (!candidate) continue;

    const iWantThem =
      me.intent.mode === "selected"
        ? me.intent.targets.includes(candidateId)
        : await areFriends(admin, userId, candidateId);
    const theyWantMe =
      candidate.intent.mode === "selected"
        ? candidate.intent.targets.includes(userId)
        : await areFriends(admin, userId, candidateId);

    if (!iWantThem || !theyWantMe) continue;

    const overlap = intersectSlots(me.availability, candidate.availability);
    const run = longestContiguousRun(overlap);
    if (!run) continue;

    const [userA, userB] = [userId, candidateId].sort();
    await admin.from("matches").upsert(
      {
        user_a: userA,
        user_b: userB,
        date,
        overlap_start: run.start,
        overlap_end: run.end,
      },
      { onConflict: "user_a,user_b,date" }
    );
  }

  return getMatchesForUser(admin, userId, date);
}

async function getIntentAndAvailability(
  admin: SupabaseClient,
  userId: string,
  date: string
): Promise<{ intent: IntentRow; availability: number[] } | null> {
  const { data: intent } = await admin
    .from("daily_intents")
    .select("id, mode")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (!intent) return null;

  // Fetched regardless of mode: in 'selected' mode these are the hard
  // candidate restriction; in 'anyone' mode they're an optional priority
  // list that doesn't affect whether a match happens, only its display
  // order (see getMatchesForUser).
  const { data: targetRows } = await admin
    .from("intent_targets")
    .select("target_user_id")
    .eq("intent_id", intent.id);
  const targets = (targetRows ?? []).map((t) => t.target_user_id as string);

  const { data: availRow } = await admin
    .from("availabilities")
    .select("slots")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  return {
    intent: { mode: intent.mode as IntentMode, targets },
    availability: (availRow?.slots as number[] | undefined) ?? [],
  };
}

async function areFriends(admin: SupabaseClient, a: string, b: string) {
  const { data } = await admin
    .from("friendships")
    .select("id")
    .eq("user_id", a)
    .eq("friend_id", b)
    .maybeSingle();
  return !!data;
}

export async function getMatchesForUser(
  admin: SupabaseClient,
  userId: string,
  date: string
): Promise<MatchWithFriend[]> {
  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .eq("date", date)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (!matches || matches.length === 0) return [];

  // "Preferred" = friends the caller listed in their own intent_targets for
  // this date — meaningful in both modes (see recomputeMatchesForUser).
  // Used only to sort/badge results, never computed by the caller's own
  // request (this always re-derives from what was actually saved).
  const { data: myIntent } = await admin
    .from("daily_intents")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  let preferredIds = new Set<string>();
  if (myIntent) {
    const { data: myTargets } = await admin
      .from("intent_targets")
      .select("target_user_id")
      .eq("intent_id", myIntent.id);
    preferredIds = new Set((myTargets ?? []).map((t) => t.target_user_id as string));
  }

  const friendIds = matches.map((m) => (m.user_a === userId ? m.user_b : m.user_a));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, avatar_url, is_demo")
    .in("id", friendIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result = matches.map((m) => {
    const friendId = m.user_a === userId ? m.user_b : m.user_a;
    const friend = profileMap.get(friendId) ?? {
      id: friendId,
      name: "友達",
      avatar_url: null,
      is_demo: false,
    };
    return { ...m, friend, preferred: preferredIds.has(friendId) } as MatchWithFriend;
  });

  // Preferred matches first, then earliest start time.
  result.sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.overlap_start - b.overlap_start);
  return result;
}
