-- View for the lesson window (DATA_CONTRACT query #3)
-- Active students of the journal's class left-joined with record, behavior, exits, assessments.
-- security_invoker = true → underlying table RLS still applies.

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
              'kind', a.kind
            ) order by a.kind, a.created_at)
     from public.assessments a
     where a.lesson_id = l.id and a.student_id = s.id),
    '[]'::json
  )                            as assessments
from public.lessons l
join public.journals j on j.id = l.journal_id
join public.students s on s.class_id = j.class_id and s.is_active = true
left join public.lesson_records lr
  on lr.lesson_id = l.id and lr.student_id = s.id;

comment on view public.v_lesson_window is
  'Lesson window: active students + left-joined record/behavior/exits/assessments. RLS via security_invoker.';

grant select on public.v_lesson_window to authenticated;
