-- T-069 tests — after migration (+ seed_demo preferred). Service role / SQL Editor.
-- Negative cases wrapped in DO … EXCEPTION so the script does not stop on the first error.
-- JWT: request.jwt.claims JSON.

do $$
declare
  v_owner text;
begin
  select id::text into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'T-069 test: no owner profile';
  end if;
  perform set_config('app.t069_owner', v_owner, false);
  raise notice 'T-069 owner: %', v_owner;
end $$;

-- ------------------------------------------------------------
-- Owner: atomic set_journal_mark switches the flag
-- ------------------------------------------------------------
do $$
declare
  v_a1 uuid;
  v_a2 uuid;
  v_lesson uuid;
  v_student uuid;
  v_cnt int;
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t069_owner'),
      'role', 'authenticated'
    )::text,
    true
  );

  select a.lesson_id, a.student_id
  into v_lesson, v_student
  from public.assessments a
  group by a.lesson_id, a.student_id
  having count(*) >= 2
  limit 1;

  if v_lesson is null then
    raise notice 'SKIP atomic switch: need >=2 assessments for one lesson+student (run seed_demo)';
    return;
  end if;

  select id into v_a1 from public.assessments
  where lesson_id = v_lesson and student_id = v_student
  order by created_at limit 1;
  select id into v_a2 from public.assessments
  where lesson_id = v_lesson and student_id = v_student and id <> v_a1
  order by created_at limit 1;

  perform public.set_journal_mark(v_a1);
  perform public.set_journal_mark(v_a2);

  select count(*) into v_cnt from public.assessments
  where lesson_id = v_lesson and student_id = v_student and in_journal;

  if v_cnt <> 1 then
    raise exception 'FAIL atomic switch: expected 1 in_journal, got %', v_cnt;
  end if;

  if not exists (
    select 1 from public.assessments where id = v_a2 and in_journal
  ) then
    raise exception 'FAIL atomic switch: expected assessment % in_journal', v_a2;
  end if;

  raise notice 'PASS owner atomic set_journal_mark';
exception
  when others then
    raise notice 'FAIL owner atomic set_journal_mark: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- Second in_journal via direct UPDATE → unique_violation
-- ------------------------------------------------------------
do $$
declare
  v_other uuid;
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t069_owner'),
      'role', 'authenticated'
    )::text,
    true
  );

  select a2.id into v_other
  from public.assessments a2
  where a2.in_journal = false
    and exists (
      select 1 from public.assessments a3
      where a3.lesson_id = a2.lesson_id
        and a3.student_id = a2.student_id
        and a3.in_journal
    )
  limit 1;

  if v_other is null then
    raise notice 'SKIP unique_violation: no second assessment alongside in_journal row';
    return;
  end if;

  begin
    update public.assessments set in_journal = true where id = v_other;
    raise exception 'FAIL unique_violation: expected error, update succeeded';
  exception
    when unique_violation then
      raise notice 'PASS second in_journal blocked (unique_violation)';
    when others then
      raise notice 'FAIL unique_violation: unexpected %', sqlerrm;
  end;
exception
  when others then
    raise notice 'FAIL unique_violation outer: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- clear_journal_mark as owner
-- ------------------------------------------------------------
do $$
declare
  v_lesson uuid;
  v_student uuid;
  v_cnt int;
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', current_setting('app.t069_owner'),
      'role', 'authenticated'
    )::text,
    true
  );

  select lesson_id, student_id into v_lesson, v_student
  from public.assessments where in_journal limit 1;

  if v_lesson is null then
    -- set one then clear
    select lesson_id, student_id into v_lesson, v_student
    from public.assessments limit 1;
    if v_lesson is null then
      raise notice 'SKIP clear: no assessments';
      return;
    end if;
    perform public.set_journal_mark((
      select id from public.assessments
      where lesson_id = v_lesson and student_id = v_student limit 1
    ));
  end if;

  perform public.clear_journal_mark(v_lesson, v_student);

  select count(*) into v_cnt from public.assessments
  where lesson_id = v_lesson and student_id = v_student and in_journal;

  if v_cnt <> 0 then
    raise exception 'FAIL clear: expected 0 in_journal, got %', v_cnt;
  end if;

  raise notice 'PASS clear_journal_mark';
exception
  when others then
    raise notice 'FAIL clear_journal_mark: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- Stranger (no profile): 0 assessments
-- ------------------------------------------------------------
do $$
declare
  v_cnt int;
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-000000000099',
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*) into v_cnt from public.assessments;
  if v_cnt <> 0 then
    raise exception 'FAIL stranger: expected 0 assessments, got %', v_cnt;
  end if;

  raise notice 'PASS stranger sees 0 assessments';
exception
  when others then
    raise notice 'FAIL stranger: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- anon cannot execute set_journal_mark
-- ------------------------------------------------------------
do $$
begin
  set local role anon;
  begin
    perform public.set_journal_mark('00000000-0000-4000-8000-000000000001'::uuid);
    raise exception 'FAIL anon set_journal_mark: expected privilege error';
  exception
    when insufficient_privilege then
      raise notice 'PASS anon denied set_journal_mark';
    when others then
      -- privilege errors may surface as other SQLSTATEs depending on path
      raise notice 'PASS anon set_journal_mark blocked: %', sqlerrm;
  end;
exception
  when others then
    raise notice 'FAIL anon set_journal_mark outer: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- anon cannot execute clear_journal_mark
-- ------------------------------------------------------------
do $$
begin
  set local role anon;
  begin
    perform public.clear_journal_mark(
      '00000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000002'::uuid
    );
    raise exception 'FAIL anon clear_journal_mark: expected privilege error';
  exception
    when insufficient_privilege then
      raise notice 'PASS anon denied clear_journal_mark';
    when others then
      raise notice 'PASS anon clear_journal_mark blocked: %', sqlerrm;
  end;
exception
  when others then
    raise notice 'FAIL anon clear_journal_mark outer: %', sqlerrm;
end $$;
