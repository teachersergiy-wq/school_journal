-- T-023B RLS checks — run ONLY after T-023A migration is applied on live.
-- Use SQL Editor as postgres/service role for setup; tests switch roles.
-- All mutating sections use BEGIN … ROLLBACK. Synthetic data only.
-- Fill results into docs/RLS_TEST_REPORT.md

-- Prerequisites:
--   T-023A applied; at least one profiles.role = 'owner'.
--   Optional: T-024 seed_demo for (e) v_lesson_window rows.

-- ============================================================
-- (b) anon — expect privilege failures / no access
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
-- (c) authenticated with random JWT sub (no profile) — 0 rows
-- ============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) as no_profile_journals from public.journals;
  select count(*) as no_profile_lessons from public.lessons;
  select count(*) as no_profile_records from public.lesson_records;
  select count(*) as no_profile_view from public.v_lesson_window;
rollback;

-- ============================================================
-- (d) authenticated cannot UPDATE profiles.role (column privilege)
-- Replace OWNER_UUID with real owner id from profiles.
-- ============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'OWNER_UUID', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);

  update public.profiles
  set role = 'teacher'
  where id = (select auth.uid());
rollback;

-- ============================================================
-- (a) owner as authenticated — read/write (rollback)
-- Replace OWNER_UUID after looking up profiles.
-- ============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'OWNER_UUID', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) as owner_journals from public.journals;
  select count(*) as owner_lessons from public.lessons;
  select count(*) as owner_records from public.lesson_records;

  update public.lessons
  set topic = coalesce(topic, '') || ''
  where id in (select id from public.lessons limit 1);
rollback;

-- ============================================================
-- (e) v_lesson_window — owner vs stranger (needs T-024)
-- ============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'OWNER_UUID', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*) as owner_window_rows from public.v_lesson_window;
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*) as stranger_window_rows from public.v_lesson_window;
rollback;
