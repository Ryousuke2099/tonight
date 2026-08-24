# Tonight — Architecture

## 1. Concept in one line

Double opt-in mutual availability for existing friends. Nobody's intent to talk is
ever shown to anyone until *both* sides want to talk *and* their free time overlaps.

## 2. Page map

| Route | Spec screen | Notes |
|---|---|---|
| `/` | ① Landing / Onboarding | Public. Value prop + CTA. |
| `/login` | (auth) | Email magic link **or** one-tap demo login as Haru/Yuki/Mei/Ren/Sora/Takumi. |
| `/home` | ②Home + ③Friend Selection + ④Availability + ⑤Waiting + ⑥Match | One stateful wizard, in this **fixed order**: Mode → Availability → (Friend Selection, only if mode = "selected") → Waiting/Match. Kept as a single page (instead of 4 routes) so the "3 taps" goal is achievable and so the match card can appear in place via Realtime without a page transition. Internally these are still 4 distinct step components (`ModeStep`, `AvailabilityStep`, `FriendsStep`, `StatusStep`) mapped 1:1 to the spec's screens. |
| `/invite` | ⑦ Invite | Create a share link for tonight. |
| `/i/[token]` | ⑧ Guest Response | Public, **no login required**. |

Order is enforced in code (`src/app/home/page.tsx`): a user cannot reach the friend
list before availability is saved, per the explicit requirement that Availability
must precede Intent Target Selection.

## 3. Data model (Supabase Postgres)

```
profiles            id (=auth.users.id), name, avatar_url, is_demo, created_at
friendships         id, user_id, friend_id, created_at        -- symmetric, auto-mutual on seed/invite-accept
daily_intents       id, user_id, date, mode ('anyone'|'selected'), created_at, updated_at   -- unique(user_id,date)
intent_targets      id, intent_id -> daily_intents, target_user_id
availabilities       id, user_id, date, slots int[] (half-hour slot indices, 0 = 20:00), updated_at  -- unique(user_id,date)
matches              id, user_a, user_b (user_a < user_b), date, overlap_start, overlap_end, created_at  -- unique(user_a,user_b,date)
invite_links          id, creator_user_id, token, date, expires_at, created_at
guest_responses      id, invite_id -> invite_links, guest_name, response ('yes'|'no'), slots int[], created_at
```

One `availabilities` row per user per day (not per friend) — matches the
requirement that availability is a single daily set, independent of who it's
later matched against.

## 4. Privacy enforcement (the whole point of the product)

Row Level Security covers user-owned reads/writes (`profiles`, `friendships`,
`daily_intents`, `intent_targets`, `availabilities`, `matches` — a user may only
ever read `matches` rows where they are `user_a` or `user_b`).

Cross-user computation (the matcher) and unauthenticated guest flows never run
on the client. They're server-only Route Handlers using the Supabase **service
role** key, so a client can never query "who selected me." There is deliberately
no API that returns another user's intent, target list, or raw availability —
only the computed overlap once both sides opt in.

## 5. Match algorithm (`src/lib/match.ts`, runs server-side in `/api/intent`)

For user `U` saving today's intent:

1. Build candidate set:
   - mode = "selected" → `U`'s chosen targets.
   - mode = "anyone" → all of `U`'s friends who also have *any* intent saved today.
2. For each candidate `C` with a saved intent today, mutual interest holds iff:
   - `U` targets `C` (directly, or `U.mode == 'anyone'` and they're friends), **and**
   - `C` targets `U` (directly, or `C.mode == 'anyone'` and they're friends).
3. If mutual, intersect `U`'s and `C`'s `slots` arrays. If the intersection is
   non-empty, take its longest contiguous run and upsert into `matches`
   (`user_a < user_b` normalized, so this is idempotent from either side).
4. Both clients are subscribed to `matches` via Supabase Realtime
   (`user_a=eq.<me>` OR `user_b=eq.<me>`), so a match appears instantly on both
   phones without polling.

## 6. Invite / guest flow (cold start)

1. `/invite` → `POST /api/invite` creates `invite_links(token, date, creator_user_id)`.
2. Link `/i/<token>` shared via LINE / copy.
3. Guest opens it — no signup wall. Enters a display name, answers
   話せる/今日は難しい, and if 話せる, picks time slots with the same
   When2meet component.
4. `POST /api/invite/[token]/respond` stores the `guest_responses` row and (server
   side) intersects the guest's slots with the inviter's saved `availabilities`
   for that date. The overlap is returned directly to the guest AND written so
   the inviter sees it live (the inviter's `/home` subscribes to
   `guest_responses` for their own invite ids via Realtime).
5. Only after the guest sees a result does the UI offer "次回からもっと簡単に使う"
   (sign up) — the signup wall sits behind the value moment, never in front of it.

## 7. Auth

Supabase Auth, email magic link for real usage. For the hackathon demo, seeded
demo users (Haru/Yuki/Mei/Ren/Sora/Takumi) are real `auth.users` rows with a
shared demo password so `/login` can offer one-tap sign-in as any of them —
this is what makes the 3-device demo scenario (§17) actually runnable.

## 8. Realtime

Supabase Realtime (Postgres changes) on `matches` and `guest_responses`,
scoped by RLS to rows the logged-in user is a party to.
