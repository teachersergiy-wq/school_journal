-- T-069 tests — run after migration + seed_demo as service role; use rollbacks.
-- Expect: unique in_journal; RPCs owner-only via RLS; anon denied.

do $$
declare
  v_owner text;
begin
  select id::text into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'T-069 test: no owner profile';
  end if;
  perform set_config('app.t069_owner', v_owner, false);
end $$;

-- Two in_journal flags for same lesson+student must fail (partial unique index)
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('app.t069_owner'), 'role', 'authenticated')::text,
    true
  );

  -- pick a student+lesson that already has one in_journal from seed (rn=4 style)
  -- force second true via direct update should raise unique_violation
  update public.assessments a
  set in_journal = true
  where a.id = (
    select a2.id from public.assessments a2
    where a2.in_journal = false
      and exists (
        select 1 from public.assessments a3
        where a3.lesson_id = a2.lesson_id
          and a3.student_id = a2.student_id
          and a3.in_journal
      )
    limit 1
  );
  -- expect: ERROR unique_violation
rollback;

-- set_journal_mark / clear as owner
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('app.t069_owner'), 'role', 'authenticated')::text,
    true
  );

  perform public.set_journal_mark((
    select id from public.assessments where in_journal = false limit 1
  ));
  perform public.clear_journal_mark(
    (select lesson_id from public.assessments limit 1),
    (select student_id from public.assessments limit 1)
  );
rollback;

-- stranger: 0 rows / no effect via RLS
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
  select count(*) as stranger_assessments from public.assessments;
  -- expect 0
rollback;

-- anon cannot execute RPCs
begin;
  set local role anon;
  select public.set_journal_mark('00000000-0000-4000-8000-000000000001'::uuid);
rollback;

begin;
  set local role anon;
  select public.clear_journal_mark(
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid
  );
rollback;
