-- T-023A Security hardening (single-user model)
-- Do NOT apply to live until Claude ACCEPTED this PR.
-- Scope: only owner uses the system; teacher role dormant; anon must have nothing.

-- ============================================================
-- A. Revoke broad privileges from anon / PUBLIC
-- ============================================================
revoke all on schema public from anon, public;
grant usage on schema public to authenticated;

-- Tables
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on table public.%I from anon, public', r.tablename);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.tablename);
  end loop;
end $$;

-- Sequences
do $$
declare r record;
begin
  for r in
    select sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('revoke all on sequence public.%I from anon, public', r.sequencename);
    execute format('grant usage, select on sequence public.%I to authenticated', r.sequencename);
  end loop;
end $$;

-- Views
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.views where table_schema = 'public'
  loop
    execute format('revoke all on table public.%I from anon, public', r.table_name);
    execute format('grant select on table public.%I to authenticated', r.table_name);
  end loop;
end $$;

-- Default privileges: new objects must not go to anon
alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public revoke all on sequences from anon, public;
alter default privileges in schema public revoke all on functions from anon, public;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- ============================================================
-- B. profiles: block role/id changes by authenticated; no INSERT for clients
-- ============================================================
revoke insert on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant update (display_name, updated_at) on table public.profiles to authenticated;
grant select on table public.profiles to authenticated;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed';
  end if;
  if new.role is distinct from old.role then
    if coalesce(
         (select role from public.profiles where id = auth.uid()),
         'teacher'::public.app_role
       ) is distinct from 'owner'::public.app_role then
      raise exception 'profiles.role can only be changed by owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_escalation on public.profiles;
create trigger profiles_no_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ============================================================
-- C. Drop old policies and recreate TO authenticated (owner-only)
-- ============================================================
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner'
  );
$$;

create policy profiles_select_own_or_owner
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());

create policy profiles_update_own_name
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_owner())
  with check (id = (select auth.uid()) or public.is_owner());

create policy profiles_all_owner
  on public.profiles for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy classes_owner_all
  on public.classes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy students_owner_all
  on public.students for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy subjects_owner_all
  on public.subjects for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy behavior_marks_owner_all
  on public.behavior_marks for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy journals_owner_all
  on public.journals for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy lessons_owner_all
  on public.lessons for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy lesson_records_owner_all
  on public.lesson_records for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy lesson_record_behavior_owner_all
  on public.lesson_record_behavior for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy lesson_exits_owner_all
  on public.lesson_exits for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy assessments_owner_all
  on public.assessments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- D. Functions: pin search_path; revoke EXECUTE from anon/public
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_journal_teacher(j_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journals
    where id = j_id and teacher_id = (select auth.uid())
  );
$$;

create or replace function public.is_class_teacher(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journals
    where class_id = c_id and teacher_id = (select auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email, 'User'),
    'teacher'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_journal_teacher(uuid) from public, anon;
revoke all on function public.is_class_teacher(uuid) from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_escalation() from public, anon, authenticated;

revoke all on function public.save_lesson_record(
  uuid, uuid, boolean, public.hw_status, boolean, boolean, boolean, boolean, smallint, uuid[], public.exit_reason[]
) from public, anon;
grant execute on function public.save_lesson_record(
  uuid, uuid, boolean, public.hw_status, boolean, boolean, boolean, boolean, smallint, uuid[], public.exit_reason[]
) to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- ============================================================
-- E. v_lesson_window
-- ============================================================
revoke all on table public.v_lesson_window from anon, public;
grant select on table public.v_lesson_window to authenticated;

comment on function public.is_owner is 'Single-user model: true if profiles.role = owner for auth.uid()';
comment on function public.prevent_profile_privilege_escalation is 'Blocks non-owner from changing profiles.role or id';
