// Shared domain types. Kept hand-written (rather than generated) since the
// schema is small and stable; regenerate with `supabase gen types` if it grows.

export type IntentMode = "anyone" | "selected";
export type GuestResponseType = "yes" | "no";

/** Half-hour slot index. 0 = 20:00, 1 = 20:30, ... 11 = 25:30 (01:30 next day). */
export type SlotIndex = number;

export const SLOT_COUNT = 12; // 20:00 -> 26:00 (02:00), 30-minute steps
export const SLOT_START_HOUR = 20; // window opens at 20:00

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  is_demo: boolean;
  personality_type: string | null;
  /** 交換日記で、友達登録なしに特定の相手を指定するための6桁公開ID。 */
  public_user_id: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

export interface DailyIntent {
  id: string;
  user_id: string;
  date: string;
  mode: IntentMode;
  created_at: string;
  updated_at: string;
}

export interface IntentTarget {
  id: string;
  intent_id: string;
  target_user_id: string;
  created_at: string;
}

export interface Availability {
  id: string;
  user_id: string;
  date: string;
  slots: SlotIndex[];
  updated_at: string;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  date: string;
  overlap_start: SlotIndex;
  overlap_end: SlotIndex;
  created_at: string;
}

export interface MatchWithFriend extends Match {
  friend: Pick<Profile, "id" | "name" | "avatar_url" | "is_demo">;
  /** True if the caller listed this friend in their own intent_targets for
   * this date — meaningful in BOTH modes: a hard restriction in 'selected'
   * mode, an optional priority pick in 'anyone' mode. Used to sort/badge
   * matches, never to gate whether a match happens. */
  preferred: boolean;
}

export interface InviteLink {
  id: string;
  creator_user_id: string;
  token: string;
  date: string;
  expires_at: string;
  created_at: string;
}

export interface GuestResponse {
  id: string;
  invite_id: string;
  guest_name: string;
  response: GuestResponseType;
  slots: SlotIndex[];
  overlap_start: SlotIndex | null;
  overlap_end: SlotIndex | null;
  created_at: string;
}

// ───────────────────────────────────────────────────────────────────────
// 交換日記 (diary) — Woolink 版モデル(HamstarCode/woolink-Tornado2026-TeamH
// commit 327ae85 を移植)。毎晩20:00〜翌20:00の1本勝負: 1人1晩1提出、
// 相手を公開IDで指定するか、性格タイプで自動マッチング。
// ───────────────────────────────────────────────────────────────────────

export interface DiaryRoom {
  id: string;
  user_a_id: string;
  user_b_id: string;
  started_at: string;
  ended_at: string;
  created_at: string;
}

export interface DiarySubmission {
  id: string;
  user_id: string;
  diary: string;
  target_public_user_id: string | null;
  room_id: string | null;
  created_at: string;
}
