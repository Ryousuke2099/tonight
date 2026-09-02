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
// 交換日記 (diary)
// ───────────────────────────────────────────────────────────────────────

/** 'a' = 面識のない相手（期間/往復制限あり）, 'b' = 既存の友達（無制限）。 */
export type DiaryMode = "a" | "b";

export interface DiaryRoom {
  id: string;
  user_a: string;
  user_b: string;
  mode: DiaryMode;
  exchange_count: number;
  max_exchanges: number | null;
  window_expires_at: string | null;
  interest_a: boolean;
  interest_b: boolean;
  converted_to_friend_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface DiaryRoomWithPartner extends DiaryRoom {
  partner: Pick<Profile, "id" | "name" | "avatar_url" | "is_demo">;
  /** my_interest / partner_interest — user_a/user_b を呼び出し側から見て
   * 読みやすくするための派生フィールド（API側で計算して付与）。 */
  my_interest: boolean;
  partner_interest: boolean;
  latest_entry_at: string | null;
}

export interface DiaryEntry {
  id: string;
  room_id: string;
  author_id: string;
  prompt: string | null;
  body: string;
  created_at: string;
}
