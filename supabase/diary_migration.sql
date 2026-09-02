-- Tonight — 交換日記 + 対人スタイル診断 統合マイグレーション (2026-09-02)
-- schema.sql の後に、同じ Supabase プロジェクト ("TAKUMI-06's Project") に
-- 対して実行してください。additive のみ・安全に再実行可能 (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS)。
--
-- 背景: 交換日記（HamstarCode/exchange-diary）は Supabase Auth を使わない
-- 自前ID（crypto.randomUUID）モデルだったため、そのままでは日調の
-- auth.users / profiles / RLS モデルと噛み合わない。このマイグレーションは
-- 交換日記のテーブルを「profiles.id（= auth.users.id）を参照する」形に
-- 作り直したもの — exchange-diary の元テーブル(users/submissions/rooms/
-- replies)は移植せず、Tonight のドメインモデルに合わせて再設計している。

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: 対人スタイル診断の結果タイプを保持（診断は匿名で受けられるが、
-- ログイン後に保存すると、将来のモードA自動マッチングの相性判定に使える）
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists personality_type text;

-- ─────────────────────────────────────────────────────────────────────────
-- diary_rooms: 交換日記のペア。
--   mode 'a' = 面識のない相手（対人スタイル診断→自動マッチングで成立。
--              期間 or 往復回数の上限つき。相互に「続けたい」を指定すると
--              知人化してfriendshipsへ書き込まれる）
--   mode 'b' = 既存の友達同士（無制限。日調のfriendshipsが前提）
-- user_a/user_b は matches テーブルと同じく辞書順の小さい方を user_a とし、
-- (user_a, user_b, mode) の一意性キーにする。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.diary_rooms (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('a', 'b')),
  exchange_count int not null default 0,
  max_exchanges int, -- モードAのみ。到達したら新規投稿は締切（続けたい判定は可）。
  window_expires_at timestamptz, -- モードAのみ。期限 or 往復上限、どちらか先に到達で終了。
  interest_a boolean not null default false, -- 「知人になって続けたい」の相互指定
  interest_b boolean not null default false,
  converted_to_friend_at timestamptz,
  closed_at timestamptz, -- 期限/上限到達、または片方のみ興味なしで自然終了した日時
  created_at timestamptz not null default now(),
  unique (user_a, user_b, mode),
  check (user_a < user_b)
);

-- ─────────────────────────────────────────────────────────────────────────
-- diary_entries: 1エントリ = 1回分の日記。prompt はお題テンプレを選んだ
-- 場合のみセット（自由記述ならnull）— CJM分析で「書くことに迷わない」ため
-- に挙がったお題テンプレ機能に対応。テンプレ文言自体は DB でなく
-- src/lib/diary-prompts.ts に持つ（差し替えやすいよう）。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.diary_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  prompt text,
  body text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- diary_match_queue: モードA専用の待合室。1人1行（既に列に並んでいたら
-- upsert）。2人目が入った瞬間に /api/diary/queue がその場でマッチングを
-- 試みる（元の exchange-diary は毎朝5時のバッチだったが、ハッカソンの
-- デモでは「並んだら即マッチ」の方が体験として分かりやすいため簡略化 —
-- 詳細な相性アルゴリズムは要検討として architecture doc に記載済み）。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.diary_match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  personality_type text,
  joined_at timestamptz not null default now()
);

alter table public.diary_rooms enable row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_match_queue enable row level security;

-- diary_rooms ─────────────────────────────────────────────────────────────
drop policy if exists "read own diary rooms" on public.diary_rooms;
create policy "read own diary rooms"
  on public.diary_rooms for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- クライアントから直接 insert できるのは mode='b'（既に友達）の場合のみ。
-- mode='a' の部屋は service-role のマッチャー（/api/diary/queue）だけが作る。
drop policy if exists "insert own mode-b diary rooms" on public.diary_rooms;
create policy "insert own mode-b diary rooms"
  on public.diary_rooms for insert
  to authenticated
  with check (
    mode = 'b'
    and (auth.uid() = user_a or auth.uid() = user_b)
    and exists (
      select 1 from public.friendships f
      where f.user_id = user_a and f.friend_id = user_b
    )
  );

drop policy if exists "update own diary rooms" on public.diary_rooms;
create policy "update own diary rooms"
  on public.diary_rooms for update
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- diary_entries ───────────────────────────────────────────────────────────
drop policy if exists "read entries in own rooms" on public.diary_entries;
create policy "read entries in own rooms"
  on public.diary_entries for select
  to authenticated
  using (exists (
    select 1 from public.diary_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  ));

drop policy if exists "write own entries in own rooms" on public.diary_entries;
create policy "write own entries in own rooms"
  on public.diary_entries for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.diary_rooms r
      where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
    )
  );

-- diary_match_queue ───────────────────────────────────────────────────────
drop policy if exists "manage own queue entry" on public.diary_match_queue;
create policy "manage own queue entry"
  on public.diary_match_queue for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: 部屋のエントリと自分の部屋一覧をリアルタイム購読できるように。
-- matches/guest_responses と同じ existence-check 付きパターン。
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'diary_entries'
  ) then
    alter publication supabase_realtime add table public.diary_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'diary_rooms'
  ) then
    alter publication supabase_realtime add table public.diary_rooms;
  end if;
end $$;
