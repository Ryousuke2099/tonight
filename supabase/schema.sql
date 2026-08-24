-- Tonight — schema
-- Run this in the Supabase SQL editor (or `supabase db execute -f supabase/schema.sql`)
-- against a fresh project. Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: 1:1 with auth.users
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever a new auth user is created. Also:
-- flags @tonight.demo accounts as is_demo, and auto-friends every *real*
-- (non-demo) signup with the four "always active" demo companions (Haru/
-- Yuki/Mei/Ren) so a brand-new user can see a real match immediately after
-- registering only their own info — no need to also control a second
-- account. See ensureDemoCompanionsActiveFor() in src/lib/demo-companions.ts
-- for the other half (keeping those companions' daily intent fresh).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  companion_email text;
begin
  insert into public.profiles (id, name, avatar_url, is_demo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email like '%@tonight.demo'
  )
  on conflict (id) do nothing;

  if new.email not like '%@tonight.demo' then
    for companion_email in
      select unnest(array['haru@tonight.demo', 'yuki@tonight.demo', 'mei@tonight.demo', 'ren@tonight.demo'])
    loop
      insert into public.friendships (user_id, friend_id)
      select new.id, u.id from auth.users u where u.email = companion_email
      on conflict (user_id, friend_id) do nothing;

      insert into public.friendships (user_id, friend_id)
      select u.id, new.id from auth.users u where u.email = companion_email
      on conflict (user_id, friend_id) do nothing;
    end loop;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- friendships: symmetric. one row per (user_id, friend_id); we always write
-- both directions so a simple "user_id = me" query returns the full list.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- daily_intents: one per user per date. mode is 'anyone' or 'selected'.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.daily_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  mode text not null check (mode in ('anyone', 'selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.intent_targets (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.daily_intents(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (intent_id, target_user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- availabilities: ONE set per user per day (not per-friend). `slots` holds
-- half-hour slot indices, where 0 = 20:00, 1 = 20:30, ... 11 = 25:30 (01:30).
-- Window is 20:00 -> 26:00 (02:00) => 12 slots, indices 0..11.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  slots int[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────
-- matches: computed server-side only. user_a is always the lexicographically
-- smaller uuid so (user_a, user_b, date) is a stable idempotency key.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  overlap_start int not null,
  overlap_end int not null,
  created_at timestamptz not null default now(),
  unique (user_a, user_b, date),
  check (user_a < user_b)
);

-- ─────────────────────────────────────────────────────────────────────────
-- invite_links + guest_responses: cold-start flow, no auth required to answer
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  date date not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_responses (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invite_links(id) on delete cascade,
  guest_name text not null,
  response text not null check (response in ('yes', 'no')),
  slots int[] not null default '{}',
  overlap_start int,
  overlap_end int,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- sent_reminders: idempotency guard for the daily day-of reminder email
-- (see /api/cron/reminders). One row per (user, date) that's already been
-- emailed, so a retried or duplicate cron run never double-sends. Written
-- only by the service-role cron route — no client-facing policies.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.sent_reminders enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.daily_intents enable row level security;
alter table public.intent_targets enable row level security;
alter table public.availabilities enable row level security;
alter table public.matches enable row level security;
alter table public.invite_links enable row level security;
alter table public.guest_responses enable row level security;

-- profiles: any signed-in user can read basic profile info (needed to render
-- a friend's name/avatar); only the owner can update their own row. No public
-- (anon) select — guests never query profiles directly, only via server routes.
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- friendships: only see rows you're part of
drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "insert own friendships" on public.friendships;
create policy "insert own friendships"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

-- daily_intents: STRICTLY owner-only. This is the core privacy guarantee —
-- nobody can ever read another user's intent directly.
drop policy if exists "own intents only" on public.daily_intents;
create policy "own intents only"
  on public.daily_intents for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own intent targets only" on public.intent_targets;
create policy "own intent targets only"
  on public.intent_targets for all
  to authenticated
  using (exists (select 1 from public.daily_intents di where di.id = intent_id and di.user_id = auth.uid()))
  with check (exists (select 1 from public.daily_intents di where di.id = intent_id and di.user_id = auth.uid()));

-- availabilities: owner-only
drop policy if exists "own availability only" on public.availabilities;
create policy "own availability only"
  on public.availabilities for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- matches: readable only by the two participants. Never written by clients —
-- only the service-role matcher inserts here.
drop policy if exists "read own matches" on public.matches;
create policy "read own matches"
  on public.matches for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- invite_links: creator can read/manage their own. Guests reach invites only
-- through the server-side (service role) route handler, never directly.
drop policy if exists "read own invites" on public.invite_links;
create policy "read own invites"
  on public.invite_links for select
  to authenticated
  using (auth.uid() = creator_user_id);

drop policy if exists "create own invites" on public.invite_links;
create policy "create own invites"
  on public.invite_links for insert
  to authenticated
  with check (auth.uid() = creator_user_id);

-- guest_responses: creator of the parent invite can read responses to it.
drop policy if exists "read responses to own invites" on public.guest_responses;
create policy "read responses to own invites"
  on public.guest_responses for select
  to authenticated
  using (exists (
    select 1 from public.invite_links il
    where il.id = invite_id and il.creator_user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast changes on matches + guest_responses so clients can
-- subscribe instead of polling.
-- ─────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.guest_responses;

-- ─────────────────────────────────────────────────────────────────────────
-- One-time backfill for the demo-companion changes above, so re-running
-- this file against a project that already has users retroactively (a)
-- flags existing @tonight.demo profiles as is_demo, and (b) auto-friends
-- existing real users with the demo companions too — not just future
-- signups going through the trigger. Both are idempotent (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────
update public.profiles p
set is_demo = true
from auth.users u
where u.id = p.id and u.email like '%@tonight.demo' and p.is_demo = false;

do $$
declare
  companion_email text;
  real_user record;
begin
  for real_user in select id, email from auth.users where email not like '%@tonight.demo' loop
    for companion_email in
      select unnest(array['haru@tonight.demo', 'yuki@tonight.demo', 'mei@tonight.demo', 'ren@tonight.demo'])
    loop
      insert into public.friendships (user_id, friend_id)
      select real_user.id, u.id from auth.users u where u.email = companion_email
      on conflict (user_id, friend_id) do nothing;

      insert into public.friendships (user_id, friend_id)
      select u.id, real_user.id from auth.users u where u.email = companion_email
      on conflict (user_id, friend_id) do nothing;
    end loop;
  end loop;
end $$;
