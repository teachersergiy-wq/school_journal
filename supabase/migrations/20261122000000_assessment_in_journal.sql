-- T-069: teacher-chosen grade shown in the journal cell (in_journal).
-- One assessment per (lesson, student) may be flagged; none is also valid.
-- No automatic pick. Absent student: DB does not delete assessments.

-- 1. Column
alter table public.assessments
  add column if not exists in_journal boolean not null default false;

comment on column public.assessments.in_journal is
  'Teacher-selected grade for the journal cell (lesson × student). At most one true per pair.';

-- 2. Partial unique index: at most one in_journal per lesson+student
create unique index if not exists assessments_one_in_journal_per_student_lesson
  on public.assessments (lesson_id, student_id)
  where in_journal;

-- 3. set_journal_mark: clear others for same lesson+student, set this one
create or replace function public.set_journal_mark(p_assessment_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_id uuid;
  v_student_id uuid;
begin
  select a.lesson_id, a.student_id
  into v_lesson_id, v_student_id
  from public.assessments a
  where a.id = p_assessment_id;

  if v_lesson_id is null then
    raise exception 'set_journal_mark: assessment % not found or not visible', p_assessment_id;
  end if;

  update public.assessments
  set in_journal = false
  where lesson_id = v_lesson_id
    and student_id = v_student_id
    and in_journal
    and id is distinct from p_assessment_id;

  update public.assessments
  set in_journal = true
  where id = p_assessment_id;
end;
$$;

revoke all on function public.set_journal_mark(uuid) from public, anon;
grant execute on function public.set_journal_mark(uuid) to authenticated;

comment on function public.set_journal_mark(uuid) is
  'Atomically mark one assessment as the journal cell grade for its lesson+student.';

-- 4. clear_journal_mark: clear flag without selecting another
create or replace function public.clear_journal_mark(p_lesson_id uuid, p_student_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.assessments
  set in_journal = false
  where lesson_id = p_lesson_id
    and student_id = p_student_id
    and in_journal;
end;
$$;

revoke all on function public.clear_journal_mark(uuid, uuid) from public, anon;
grant execute on function public.clear_journal_mark(uuid, uuid) to authenticated;

comment on function public.clear_journal_mark(uuid, uuid) is
  'Clear journal-cell flag for a student on a lesson (no replacement).';

-- 5. v_lesson_window: append journal_* columns; assessments JSON includes in_journal
create or replace view public.v_lesson_window
with (security_invoker = true)
as
select
  l.id                         as lesson_id,
  l.journal_id,
  l.lesson_date,
  l.lesson_number,
  l.topic,
  s.id                         as student_id,
  s.full_name,
  s.is_active,
  lr.id                        as record_id,
  lr.is_absent,
  lr.homework,
  lr.has_notebook,
  lr.has_textbook,
  lr.not_taking_notes,
  lr.board_refused,
  lr.late_minutes,
  coalesce(
    (select array_agg(bm.code order by bm.code)
     from public.lesson_record_behavior lrb
     join public.behavior_marks bm on bm.id = lrb.mark_id
     where lrb.record_id = lr.id),
    '{}'
  )                            as behavior_codes,
  coalesce(
    (select array_agg(le.reason order by le.created_at)
     from public.lesson_exits le
     where le.record_id = lr.id),
    '{}'
  )                            as exit_reasons,
  coalesce(
    (select json_agg(json_build_object(
              'id', a.id,
              'value', a.value,
              'kind', a.kind,
              'in_journal', a.in_journal
            ) order by a.kind, a.created_at)
     from public.assessments a
     where a.lesson_id = l.id and a.student_id = s.id),
    '[]'::json
  )                            as assessments,
  ja.id                        as journal_assessment_id,
  ja.value                     as journal_value,
  ja.kind                      as journal_kind
from public.lessons l
join public.journals j on j.id = l.journal_id
join public.students s on s.class_id = j.class_id and s.is_active = true
left join public.lesson_records lr
  on lr.lesson_id = l.id and lr.student_id = s.id
left join public.assessments ja
  on ja.lesson_id = l.id and ja.student_id = s.id and ja.in_journal;

comment on view public.v_lesson_window is
  'Lesson window + optional journal cell grade (journal_*). RLS via security_invoker.';

revoke all on table public.v_lesson_window from anon, public;
grant select on public.v_lesson_window to authenticated;
