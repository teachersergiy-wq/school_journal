-- T-024 cleanup (REWORK): remove ONLY demo lessons (topic like '[ДЕМО]%').
-- Journal deleted only if no lessons remain. Students/class kept.

do $$
declare
  v_owner   uuid;
  v_class   uuid;
  v_subject uuid;
  v_journal uuid;
  v_left    int;
begin
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  select id into v_class from public.classes
  where grade = 8 and letter = 'А' and school_year = 2026 limit 1;
  select id into v_subject from public.subjects where name = 'Алгебра' limit 1;

  if v_owner is null or v_class is null or v_subject is null then
    raise notice 'T-024 cleanup: nothing to do (owner/class/subject missing)';
    return;
  end if;

  select id into v_journal from public.journals
  where class_id = v_class and subject_id = v_subject and teacher_id = v_owner limit 1;

  if v_journal is null then
    raise notice 'T-024 cleanup: journal not found';
    return;
  end if;

  delete from public.assessments
  where lesson_id in (
    select id from public.lessons
    where journal_id = v_journal and topic like '[ДЕМО]%'
  );

  delete from public.lesson_exits
  where record_id in (
    select lr.id from public.lesson_records lr
    join public.lessons l on l.id = lr.lesson_id
    where l.journal_id = v_journal and l.topic like '[ДЕМО]%'
  );

  delete from public.lesson_record_behavior
  where record_id in (
    select lr.id from public.lesson_records lr
    join public.lessons l on l.id = lr.lesson_id
    where l.journal_id = v_journal and l.topic like '[ДЕМО]%'
  );

  delete from public.lesson_records
  where lesson_id in (
    select id from public.lessons
    where journal_id = v_journal and topic like '[ДЕМО]%'
  );

  delete from public.lessons
  where journal_id = v_journal and topic like '[ДЕМО]%';

  select count(*) into v_left from public.lessons where journal_id = v_journal;
  if v_left = 0 then
    delete from public.journals where id = v_journal;
    raise notice 'T-024 cleanup OK: demo lessons removed; empty journal deleted';
  else
    raise notice 'T-024 cleanup OK: demo lessons removed; journal kept (% non-demo lessons)', v_left;
  end if;
end $$;
