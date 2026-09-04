-- Tonight — Woolink 版 交換日記 マイグレーション (2026-09-04)
-- schema.sql / call_migration.sql / diary_migration.sql の後に実行してください。
--
-- 背景: 交換日記を、この tonight リポジトリ独自の diary_rooms/diary_entries/
-- diary_match_queue モデルから、チームで正となった Woolink UI
-- (HamstarCode/woolink-Tornado2026-TeamH, commit 327ae85) 側のモデルへ
-- 全面差し替えする。旧テーブル・旧 API は別途 DROP する（本ファイルの末尾）。
--
-- Woolink 側の元マイグレーション(20260904_create_diary_exchange.sql /
-- 20260904_unique_public_user_id.sql)を、tonight の profiles.id が
-- auth.users.id を指す点も含めてそのまま流用できたためほぼ無改変で移植。
-- 変更点は1つだけ: public_user_id の発行を「オンボーディング画面での
-- 手動 insert + クライアント側リトライ」から「handle_new_user() トリガーで
-- 自動採番（サーバー側リトライ）」に変えたこと — tonight は既に
-- handle_new_user() でプロフィール行を自動生成しており(Google/マジック
-- リンク/デモログインいずれの経路でも共通)、Woolink のオンボーディング
-- フォーム(ニックネーム入力 → profiles を手動 insert)は tonight 側では
-- 使っていないため。

-- ─────────────────────────────────────────────────────────────────────────
-- profiles.public_user_id: 「公開ID」。友達登録なしで特定の相手に日記を
-- 送るための6桁コード。Woolink 側と同じ大文字小文字非区別ユニーク制約。
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists public_user_id text;

create unique index if not exists profiles_public_user_id_unique_idx
  on public.profiles (upper(public_user_id));

-- 衝突時は再抽選するヘルパー。handle_new_user() トリガーと、既存ユーザーの
-- バックフィル(下部)の両方から呼ぶ。
create or replace function public.generate_public_user_id()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.profiles where upper(public_user_id) = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- handle_new_user() を再定義: 既存の処理(profiles作成 / is_demo判定 /
-- デモ友達の自動フレンド化)はそのまま、public_user_id の採番だけ追加。
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url, is_demo, public_user_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email like '%@tonight.demo',
    public.generate_public_user_id()
  )
  on conflict (id) do nothing;

  if new.email not like '%@tonight.demo' then
    insert into public.friendships (user_id, friend_id)
    select new.id, p.id from public.profiles p
    where p.is_demo = true and p.name in ('Haru', 'Yuki', 'Mei', 'Ren')
    on conflict (user_id, friend_id) do nothing;

    insert into public.friendships (user_id, friend_id)
    select p.id, new.id from public.profiles p
    where p.is_demo = true and p.name in ('Haru', 'Yuki', 'Mei', 'Ren')
    on conflict (user_id, friend_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 既存ユーザー（このマイグレーション以前に作られた profiles 行）への
-- バックフィル。再実行しても安全（NULL の行にだけ採番）。
do $$
declare
  r record;
begin
  for r in select id from public.profiles where public_user_id is null loop
    update public.profiles
       set public_user_id = public.generate_public_user_id()
     where id = r.id;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- rooms / submissions / submit_diary(): Woolink 側の元マイグレーションを
-- そのまま移植（profiles(id) 参照はそのまま tonight のプロフィールと合う）。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint rooms_different_users check (user_a_id <> user_b_id),
  constraint rooms_valid_period check (started_at < ended_at)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  diary text not null check (char_length(btrim(diary)) between 1 and 10000),
  target_public_user_id text,
  room_id uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_exchange_lookup_idx
  on public.submissions (created_at, room_id);
create index if not exists submissions_target_lookup_idx
  on public.submissions (target_public_user_id, created_at)
  where room_id is null;

alter table public.rooms enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Participants can read their rooms" on public.rooms;
create policy "Participants can read their rooms"
  on public.rooms for select to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

drop policy if exists "Users can read their submissions" on public.submissions;
create policy "Users can read their submissions"
  on public.submissions for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
        from public.rooms
       where rooms.id = submissions.room_id
         and auth.uid() in (rooms.user_a_id, rooms.user_b_id)
    )
  );

create or replace function public.submit_diary(
  p_diary text,
  p_target_public_user_id text default null
)
returns table (submission_id uuid, room_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_public_user_id text;
  v_personality_type text;
  v_target_id text := nullif(upper(btrim(p_target_public_user_id)), '');
  v_target_user_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_candidate_submission_id uuid;
  v_candidate_user_id uuid;
  v_submission_id uuid;
  v_room_id uuid;
  v_matching_type text;
begin
  if v_user_id is null then
    raise exception 'ログインが必要です。';
  end if;

  if char_length(btrim(coalesce(p_diary, ''))) not between 1 and 10000 then
    raise exception '日記は1文字以上10000文字以内で入力してください。';
  end if;

  v_start := (
    case
      when (now() at time zone 'Asia/Tokyo')::time < time '20:00'
        then (now() at time zone 'Asia/Tokyo')::date - 1
      else (now() at time zone 'Asia/Tokyo')::date
    end + time '20:00'
  ) at time zone 'Asia/Tokyo';
  v_end := v_start + interval '1 day';

  select public_user_id, personality_type
    into v_public_user_id, v_personality_type
    from public.profiles
   where id = v_user_id;

  if v_public_user_id is null then
    raise exception 'プロフィールが見つかりません。';
  end if;

  if exists (
    select 1 from public.submissions
     where user_id = v_user_id
       and created_at >= v_start
       and created_at < v_end
  ) then
    raise exception 'このExchangeにはすでに日記を提出しています。';
  end if;

  if v_target_id is not null then
    select id into v_target_user_id
      from public.profiles
     where upper(public_user_id) = v_target_id;

    if v_target_user_id is null or v_target_user_id = v_user_id then
      raise exception '入力した公開IDのユーザーが見つかりません。';
    end if;
  end if;

  insert into public.submissions (user_id, diary, target_public_user_id)
  values (v_user_id, btrim(p_diary), v_target_id)
  returning id into v_submission_id;

  if v_target_user_id is not null then
    -- テーブルエイリアス s が必須: このあと `returns table (..., room_id uuid)`
    -- の OUT パラメータ room_id とバックティックなしの列名が衝突し、
    -- "column reference room_id is ambiguous" になる(2026-09-04 E2E で発見)。
    select s.id, s.user_id
      into v_candidate_submission_id, v_candidate_user_id
      from public.submissions s
     where s.user_id = v_target_user_id
       and upper(s.target_public_user_id) = upper(v_public_user_id)
       and s.room_id is null
       and s.created_at >= v_start
       and s.created_at < v_end
     order by s.created_at desc
     limit 1
     for update of s skip locked;
  else
    v_matching_type := case v_personality_type
      when 'PA_fast' then 'HI_fast' when 'HI_fast' then 'PA_fast'
      when 'PA_slow' then 'HI_slow' when 'HI_slow' then 'PA_slow'
      when 'BC_fast' then 'FG_fast' when 'FG_fast' then 'BC_fast'
      when 'BC_slow' then 'FG_slow' when 'FG_slow' then 'BC_slow'
      when 'DE_fast' then 'DE_fast' when 'DE_slow' then 'DE_slow'
      when 'JK_fast' then 'NO_fast' when 'NO_fast' then 'JK_fast'
      when 'JK_slow' then 'NO_slow' when 'NO_slow' then 'JK_slow'
      when 'LM_fast' then 'LM_fast' when 'LM_slow' then 'LM_slow'
      else null
    end;

    select s.id, s.user_id
      into v_candidate_submission_id, v_candidate_user_id
      from public.submissions s
      join public.profiles p on p.id = s.user_id
     where s.user_id <> v_user_id
       and s.target_public_user_id is null
       and s.room_id is null
       and s.created_at >= v_start
       and s.created_at < v_end
       and (v_matching_type is null or p.personality_type = v_matching_type)
     order by s.created_at
     limit 1
     for update of s skip locked;
  end if;

  if v_candidate_submission_id is not null then
    insert into public.rooms (user_a_id, user_b_id, started_at, ended_at)
    values (v_user_id, v_candidate_user_id, v_start, v_end)
    returning id into v_room_id;

    -- 同じ理由でエイリアス s を付ける(SET句の room_id は列そのものとして
    -- 曖昧にならないが、WHERE句の room_id is null は曖昧になる)。
    update public.submissions s
       set room_id = v_room_id
     where s.id in (v_submission_id, v_candidate_submission_id)
       and s.room_id is null;
  end if;

  return query select v_submission_id, v_room_id;
end;
$$;

revoke all on function public.submit_diary(text, text) from public;
grant execute on function public.submit_diary(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 旧モデル(tonight 独自の diary_rooms/diary_entries/diary_match_queue)の
-- 撤去。↑の rooms/submissions/submit_diary() に完全に置き換わる。
-- CASCADE で依存する RLS policy 等も一緒に消える。まだ本番でこの旧テーブルに
-- データが入っている場合は、実行前に必要なら退避してください。
-- ─────────────────────────────────────────────────────────────────────────
drop table if exists public.diary_match_queue cascade;
drop table if exists public.diary_entries cascade;
drop table if exists public.diary_rooms cascade;
