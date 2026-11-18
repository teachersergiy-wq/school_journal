-- T-023B / T-006 RLS checks — run as postgres/service role after migrations applied.
-- All mutating blocks use BEGIN … ROLLBACK. Synthetic data only.
-- JWT: request.jwt.claims JSON (not deprecated request.jwt.claim.sub).

do $$
declare
  v_owner text;
begin
  select id::text into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'no profiles.role = owner — create Auth user / set role first';
  end if;
  perform set_config('app.t023b_owner', v_owner, false);
  raise notice 'owner for checks: %', v_owner;
end $$;

-- ============================================================
-- Static: public function EXECUTE privileges
-- ============================================================
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by 1;
-- expect: anon none; authenticated only save_lesson_record

-- ============================================================
-- (b) anon — denied on public tables / RPC
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
-- (b2) T-006: anon only ops.keepalive
-- ============================================================
select
  has_schema_privilege('anon', 'public', 'usage') as anon_public_usage,
  has_schema_privilege('anon', 'private', 'usage') as anon_private_usage,
  has_schema_privilege('anon', 'ops', 'usage') as anon_ops_usage;
-- expect: false, false, true

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
rollback;

-- ============================================================
-- (c) authenticated, random JWT, no profile — 0 rows
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
-- (d) cannot UPDATE profiles.role
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
-- (a) owner read/write (rollback)
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
-- (e) v_lesson_window — owner vs stranger
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
