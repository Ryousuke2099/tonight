-- ─────────────────────────────────────────────────────────────────────────
-- 通話シグナリング (WebRTC) — Realtime Broadcast Authorization
--
-- マッチした2人だけが `call:<matchId>` トピックで offer / answer / ICE
-- candidate をやり取りできるようにする。DB には何も保存しない
-- (シグナリングは Realtime Broadcast の一時メッセージのみ)。`matches`
-- の当事者でないユーザーは、このトピックに join することもメッセージを
-- 送ることもできない ── プロダクトのプライバシー原則(双方が今夜話したいと
-- 意思表示するまで何も見えない)を通話レイヤーにも適用する。
--
-- 前提: supabase/schema.sql を先に流していること(public.matches が必要)。
-- 再実行しても安全(policy は drop してから作り直す)。
--
-- 既存の Realtime 利用(matches / guest_responses の postgres_changes 購読)は
-- Postgres CDC 経路で認可されるため、この realtime.messages への policy 追加の
-- 影響を受けない。ここで足すのは Broadcast / Presence の認可のみ。
--
-- 注: realtime.messages の RLS はホスト版 Supabase では既定で有効。かつ所有者が
-- supabase_admin なので SQL Editor の postgres ロールからは `alter table` できない
-- (42501: must be owner)。policy の作成は許可されているのでそれだけ行う。
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "call participants can receive signaling" on realtime.messages;
create policy "call participants can receive signaling"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'call:%'
    and exists (
      select 1
      from public.matches m
      where m.id = split_part(realtime.topic(), ':', 2)::uuid
        and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    )
  );

drop policy if exists "call participants can send signaling" on realtime.messages;
create policy "call participants can send signaling"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'call:%'
    and exists (
      select 1
      from public.matches m
      where m.id = split_part(realtime.topic(), ':', 2)::uuid
        and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    )
  );
