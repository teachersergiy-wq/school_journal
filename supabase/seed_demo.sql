-- T-024 synthetic demo journal data
-- ONLY fictional names («Учень NN»). Idempotent for pure-demo journals.
-- Requires: migrations (incl. independent/control kinds), starter seed, profiles.role = 'owner'.
-- Topics prefixed «[ДЕМО]». Aborts if journal already has non-demo lessons.

do $$
declare
  v_owner   uuid;
  v_class   uuid;
  v_subject uuid;
  v_journal uuid;
  v_lesson  uuid;
  v_student uuid;
  v_record  uuid;
  v_mark_disrupts uuid;
  v_mark_active uuid;
  v_mark_helps uuid;
  d date;
  i int;
  student_rec record;
  v_topic text;
  v_non_demo int;
begin
  select id into v_owner from public.profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'T-024 seed_demo: no profiles.role = owner. Create Auth user and set role first.';
  end if;

  select id into v_class from public.classes
  where grade = 8 and letter = 'А' and school_year = 2026 limit 1;
  if v_class is null then
    raise exception 'T-024 seed_demo: class 8-А 2026 missing. Run supabase/seed.sql first.';
  end if;

  select id into v_subject from public.subjects where name = 'Алгебра' limit 1;
  if v_subject is null then
    raise exception 'T-024 seed_demo: subject Алгебра missing. Run supabase/seed.sql first.';
  end if;

  select id into v_mark_disrupts from public.behavior_marks where code = 'disrupts';
  select id into v_mark_active from public.behavior_marks where code = 'active';
  select id into v_mark_helps from public.behavior_marks where code = 'helps';

  select id into v_journal from public.journals
  where class_id = v_class and subject_id = v_subject and teacher_id = v_owner limit 1;

  if v_journal is null then
    insert into public.journals (class_id, subject_id, teacher_id)
    values (v_class, v_subject, v_owner)
    returning id into v_journal;
  end if;

  select count(*) into v_non_demo
  from public.lessons
  where journal_id = v_journal
    and (topic is null or topic not like '[ДЕМО]%');

  if v_non_demo > 0 then
    raise exception
      'T-024 seed_demo: journal already has % non-demo lesson(s). Refusing to modify real data. Use a clean journal or remove non-demo lessons first.',
      v_non_demo;
  end if;

  for i in 1..5 loop
    d := date '2026-09-01' + (i - 1);
    v_topic := '[ДЕМО] ' || case i
      when 1 then 'Лінійні рівняння'
      when 2 then 'Системи рівнянь'
      when 3 then 'Квадратні рівняння'
      when 4 then 'Нерівності'
      else 'Повторення'
    end;

    select id into v_lesson from public.lessons
    where journal_id = v_journal and lesson_date = d and lesson_number = 1 limit 1;

    if v_lesson is null then
      insert into public.lessons (journal_id, lesson_date, lesson_number, topic)
      values (v_journal, d, 1, v_topic)
      returning id into v_lesson;
    else
      null;
    end if;

    for student_rec in
      select s.id, s.full_name,
             row_number() over (order by s.full_name) as rn
      from public.students s
      where s.class_id = v_class and s.is_active
    loop
      v_student := student_rec.id;

      select id into v_record from public.lesson_records
      where lesson_id = v_lesson and student_id = v_student limit 1;

      if v_record is null then
        if student_rec.rn = 1 then
          insert into public.lesson_records (
            lesson_id, student_id, is_absent, homework, has_notebook, has_textbook,
            not_taking_notes, board_refused, late_minutes
          ) values (
            v_lesson, v_student, true, null, null, null, null, false, null
          ) returning id into v_record;
        elsif student_rec.rn = 2 then
          insert into public.lesson_records (
            lesson_id, student_id, is_absent, homework, has_notebook, has_textbook,
            not_taking_notes, board_refused, late_minutes
          ) values (
            v_lesson, v_student, false, 'not_done', false, true, true, false, 7
          ) returning id into v_record;
          if v_mark_disrupts is not null then
            insert into public.lesson_record_behavior (record_id, mark_id)
            values (v_record, v_mark_disrupts) on conflict do nothing;
          end if;
          insert into public.lesson_exits (record_id, reason)
          values (v_record, 'toilet');
        elsif student_rec.rn = 3 then
          -- board refusal only (no kind=board assessment)
          insert into public.lesson_records (
            lesson_id, student_id, is_absent, homework, has_notebook, has_textbook,
            not_taking_notes, board_refused, late_minutes
          ) values (
            v_lesson, v_student, false, 'partial', true, true, false, true, null
          ) returning id into v_record;
          if v_mark_active is not null then
            insert into public.lesson_record_behavior (record_id, mark_id)
            values (v_record, v_mark_active) on conflict do nothing;
          end if;
        elsif student_rec.rn = 4 then
          insert into public.lesson_records (
            lesson_id, student_id, is_absent, homework, has_notebook, has_textbook,
            not_taking_notes, board_refused, late_minutes
          ) values (
            v_lesson, v_student, false, 'done', true, true, false, false, null
          ) returning id into v_record;
          if v_mark_helps is not null then
            insert into public.lesson_record_behavior (record_id, mark_id)
            values (v_record, v_mark_helps) on conflict do nothing;
          end if;
          insert into public.lesson_exits (record_id, reason)
          values (v_record, 'phone'), (v_record, 'other');
        else
          insert into public.lesson_records (
            lesson_id, student_id, is_absent, homework, has_notebook, has_textbook,
            not_taking_notes, board_refused, late_minutes
          ) values (
            v_lesson, v_student, false, 'done', true, true, false, false, null
          ) returning id into v_record;
        end if;
      end if;

      -- current (rn 3–6, lesson 1) — skip if would conflict; rn=3 has refusal not board grade
      if student_rec.rn between 3 and 6 and i = 1 then
        if not exists (
          select 1 from public.assessments a
          where a.lesson_id = v_lesson and a.student_id = v_student and a.kind = 'current'
        ) then
          insert into public.assessments (lesson_id, student_id, value, kind)
          values (v_lesson, v_student, 8 + (student_rec.rn % 4), 'current');
        end if;
      end if;

      if student_rec.rn = 4 and i = 2 then
        if not exists (
          select 1 from public.assessments a
          where a.lesson_id = v_lesson and a.student_id = v_student and a.kind = 'thematic'
        ) then
          insert into public.assessments (lesson_id, student_id, value, kind)
          values (v_lesson, v_student, 10, 'thematic');
        end if;
      end if;

      -- board grade only rn=4 lesson 1 (not rn=3 refusal)
      if student_rec.rn = 4 and i = 1 then
        if not exists (
          select 1 from public.assessments a
          where a.lesson_id = v_lesson and a.student_id = v_student and a.kind = 'board'
        ) then
          insert into public.assessments (lesson_id, student_id, value, kind)
          values (v_lesson, v_student, 9, 'board');
        end if;
      end if;

      -- independent (rn=5, lesson 1)
      if student_rec.rn = 5 and i = 1 then
        if not exists (
          select 1 from public.assessments a
          where a.lesson_id = v_lesson and a.student_id = v_student and a.kind = 'independent'
        ) then
          insert into public.assessments (lesson_id, student_id, value, kind)
          values (v_lesson, v_student, 8, 'independent');
        end if;
      end if;

      -- control (rn=6, lesson 1)
      if student_rec.rn = 6 and i = 1 then
        if not exists (
          select 1 from public.assessments a
          where a.lesson_id = v_lesson and a.student_id = v_student and a.kind = 'control'
        ) then
          insert into public.assessments (lesson_id, student_id, value, kind)
          values (v_lesson, v_student, 10, 'control');
        end if;
      end if;

    end loop;
  end loop;

  raise notice 'T-024 seed_demo OK: journal %, 5 [ДЕМО] lessons (kinds incl. independent/control)', v_journal;
end $$;
