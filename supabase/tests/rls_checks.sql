-- T-023B RLS checks — run ONLY after T-023A is applied on live.
-- SQL Editor as postgres/service role. All mutating blocks use BEGIN … ROLLBACK.
-- Synthetic data only. Fill results into docs/RLS_TEST_REPORT.md
--
-- Prerequisites: T-023A applied; profiles.role = 'owner' exists.
-- Optional: T-024 seed_demo for (e) v_lesson_window rows.
-- Optional: T-006 keepalive migration for ops checks.
-- JWT: use request.jwt.claims (JSON), not the deprecated request.jwt.claim.sub.

do $$
declare
  v_owner text;
begin
  select id::text into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'T-023B: no profiles.role = owner — create Auth user / set role first';
  end if;
  perform set_config('app.t023b_owner', v_owner, false);
  raise notice 'T-023B owner for checks: %', v_owner;
end $$;

-- ============================================================
-- (b) anon — expect privilege failures / no access on public
-- ============================================================
begin;
  set local role anon;
  select count(*) as anon_classes from public.classes;
  select count(*) as anon_students from public.students;
  select count(*) as anon_journals from public.journals;
  select count(*) as anon_lessons from public.lessons;
  select count(*) as anon_lesson_records from public.lesson_records;
  select count(*) as anon_assessments from public.assessments;
  select count(*) as anon_view from public.v_lesson_window;
rollback;

begin;
  set local role anon;
  select public.save_lesson_record(
    null, null, false, null, null, null, null, false, null, null, null
  );
rollback;

-- ============================================================
-- (b2) T-006: anon may ONLY call ops.keepalive(); public/private stay closed
-- ============================================================
select
  has_schema_privilege('anon', 'public', 'usage') as anon_public_usage,
  has_schema_privilege('anon', 'private', 'usage') as anon_private_usage,
  has_schema_privilege('anon', 'ops', 'usage') as anon_ops_usage;
-- expect after T-006: false, false, true

select count(*) as ops_function_count
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ops';
-- expect: 1

select count(*) as ops_table_count
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ops' and c.relkind = 'r';
-- expect: 0

begin;
  set local role anon;
  select ops.keepalive() as keepalive_as_anon;
  -- expect: integer (success)
rollback;

-- anon must not execute random public RPCs (still denied)
begin;
  set local role anon;
  select public.save_lesson_record(
    null, null, false, null, null, null, null, false, null, null, null
  );
rollback;

-- ============================================================
-- (c) authenticated with random JWT sub (no profile) — 0 rows
-- ============================================================
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000000099',
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*) as no_profile_journals from public.journals;
  select count(*) as no_profile_lessons from public.lessons;
  select count(*) as no_profile_records from public.lesson_records;
  select count(*) as no_profile_view from public.v_lesson_window;
rollback;

-- ============================================================
-- (d) authenticated cannot UPDATE profiles.role (column privilege)
-- ============================================================
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t023b_owner'),
      'role', 'authenticated'
    )::text,
    true
  );

  update public.profiles
  set role = 'teacher'
  where id = (select auth.uid());
rollback;

-- ============================================================
-- (a) owner as authenticated — read/write (rollback)
-- ============================================================
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t023b_owner'),
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*) as owner_journals from public.journals;
  select count(*) as owner_lessons from public.lessons;
  select count(*) as owner_records from public.lesson_records;

  update public.lessons
  set topic = coalesce(topic, '') || ''
  where id in (select id from public.lessons limit 1);
rollback;

-- ============================================================
-- (e) v_lesson_window — owner vs stranger (needs T-024 data)
-- ============================================================
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t023b_owner'),
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) as owner_window_rows from public.v_lesson_window;
rollback;

begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000000099',
      'role', 'authenticated'
    )::text,
    true
  );
  select count(*) as stranger_window_rows from public.v_lesson_window;
rollback;
