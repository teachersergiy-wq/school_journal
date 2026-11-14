-- T-023A Security hardening (teacher-ready single user)
-- DO NOT apply to live until Claude ACCEPTED.
-- Keeps owner AND teacher RLS policies; strips anon; blocks role self-promotion.

-- ============================================================
-- 0. Drop ALL existing public policies FIRST
--    (they reference public.current_app_role / is_*_teacher)
-- ============================================================
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- A. Privileges: strip anon/PUBLIC
-- ============================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on schema public from anon, public;
grant usage on schema public to authenticated;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon, public', r.tablename);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.tablename);
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('revoke all on sequence public.%I from anon, public', r.sequencename);
    execute format('grant usage, select on sequence public.%I to authenticated', r.sequencename);
  end loop;
  for r in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('revoke all on table public.%I from anon, public', r.table_name);
    execute format('grant select on table public.%I to authenticated', r.table_name);
  end loop;
end $$;

alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public revoke all on sequences from anon, public;
alter default privileges in schema public revoke all on functions from anon, public;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- ============================================================
-- B. profiles: no client INSERT/DELETE; cannot change role/id via API
-- ============================================================
revoke insert, delete on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, updated_at) on table public.profiles to authenticated;

create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed';
  end if;
  if new.role is distinct from old.role then
    -- SQL Editor / service role: auth.uid() is null → allow (owner admin path)
    -- Authenticated non-owner JWT: block
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    ) then
      raise exception 'profiles.role can only be changed by owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_escalation on public.profiles;
create trigger profiles_no_escalation
  before update on public.profiles
  for each row execute function private.prevent_profile_privilege_escalation();

revoke all on function private.prevent_profile_privilege_escalation() from public, anon, authenticated;

-- ============================================================
-- C. Helpers in private (after policies dropped)
-- ============================================================
create or replace function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()); $$;

create or replace function private.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner'); $$;

create or replace function private.is_journal_teacher(j_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.journals where id = j_id and teacher_id = (select auth.uid())); $$;

create or replace function private.is_class_teacher(c_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.journals where class_id = c_id and teacher_id = (select auth.uid())); $$;

grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_journal_teacher(uuid) to authenticated;
grant execute on function private.is_class_teacher(uuid) to authenticated;

drop function if exists public.current_app_role();
drop function if exists public.is_journal_teacher(uuid);
drop function if exists public.is_class_teacher(uuid);
drop function if exists public.is_owner();

-- ============================================================
-- C2. Recreate policies TO authenticated (owner + teacher)
-- ============================================================
create policy profiles_select_own_or_owner on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_owner()));
create policy profiles_update_own_name on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_owner()))
  with check (id = (select auth.uid()) or (select private.is_owner()));
create policy profiles_owner_all on public.profiles for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy classes_select_owner_or_teacher on public.classes for select to authenticated
  using ((select private.is_owner()) or (select private.is_class_teacher(id)));
create policy classes_write_owner on public.classes for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy students_select_owner_or_teacher on public.students for select to authenticated
  using ((select private.is_owner()) or (select private.is_class_teacher(class_id)));
create policy students_write_owner on public.students for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy subjects_select_auth on public.subjects for select to authenticated using (true);
create policy subjects_write_owner on public.subjects for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy behavior_marks_select_auth on public.behavior_marks for select to authenticated using (true);
create policy behavior_marks_write_owner on public.behavior_marks for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy journals_select_own_or_owner on public.journals for select to authenticated
  using (teacher_id = (select auth.uid()) or (select private.is_owner()));
create policy journals_write_owner on public.journals for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create policy lessons_select_own_or_owner on public.lessons for select to authenticated
  using ((select private.is_owner()) or (select private.is_journal_teacher(journal_id)));
create policy lessons_insert_own_or_owner on public.lessons for insert to authenticated
  with check ((select private.is_owner()) or (select private.is_journal_teacher(journal_id)));
create policy lessons_update_own_or_owner on public.lessons for update to authenticated
  using ((select private.is_owner()) or (select private.is_journal_teacher(journal_id)));
create policy lessons_delete_own_or_owner on public.lessons for delete to authenticated
  using ((select private.is_owner()) or (select private.is_journal_teacher(journal_id)));

create policy lesson_records_select_own_or_owner on public.lesson_records for select to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy lesson_records_insert_own_or_owner on public.lesson_records for insert to authenticated
  with check ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy lesson_records_update_own_or_owner on public.lesson_records for update to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy lesson_records_delete_own_or_owner on public.lesson_records for delete to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));

create policy lrb_select_own_or_owner on public.lesson_record_behavior for select to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));
create policy lrb_insert_own_or_owner on public.lesson_record_behavior for insert to authenticated
  with check ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));
create policy lrb_delete_own_or_owner on public.lesson_record_behavior for delete to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));

create policy lesson_exits_select_own_or_owner on public.lesson_exits for select to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));
create policy lesson_exits_insert_own_or_owner on public.lesson_exits for insert to authenticated
  with check ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));
create policy lesson_exits_delete_own_or_owner on public.lesson_exits for delete to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lesson_records lr join public.lessons l on l.id = lr.lesson_id
    where lr.id = record_id and (select private.is_journal_teacher(l.journal_id))));

create policy assessments_select_own_or_owner on public.assessments for select to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy assessments_insert_own_or_owner on public.assessments for insert to authenticated
  with check ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy assessments_update_own_or_owner on public.assessments for update to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));
create policy assessments_delete_own_or_owner on public.assessments for delete to authenticated
  using ((select private.is_owner()) or exists (
    select 1 from public.lessons l where l.id = lesson_id and (select private.is_journal_teacher(l.journal_id))));

-- ============================================================
-- D. set_updated_at: INVOKER + search_path only (not DEFINER)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email, 'User'), 'teacher')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.save_lesson_record(
  uuid, uuid, boolean, public.hw_status, boolean, boolean, boolean, boolean, smallint, uuid[], public.exit_reason[]
) from public, anon;
grant execute on function public.save_lesson_record(
  uuid, uuid, boolean, public.hw_status, boolean, boolean, boolean, boolean, smallint, uuid[], public.exit_reason[]
) to authenticated;

revoke all on table public.v_lesson_window from anon, public;
grant select on table public.v_lesson_window to authenticated;

comment on schema private is 'Internal RLS helpers; not for client Data API — ensure private is NOT in Settings → API exposed schemas';
