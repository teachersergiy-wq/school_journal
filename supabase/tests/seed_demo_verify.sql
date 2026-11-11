-- T-024 verification (after seed_demo, as service role / owner)

select
  (select count(*) from public.journals) as journals,
  (select count(*) from public.lessons) as lessons,
  (select count(*) from public.lesson_records) as records,
  (select count(*) from public.assessments) as assessments,
  (select count(*) from public.lesson_exits) as exits,
  (select count(*) from public.lesson_record_behavior) as behavior_links;

-- Expect roughly: journals >= 1, lessons = 5, records = 50 (10 students x 5), assessments > 0

select full_name, is_absent, homework, board_refused, late_minutes,
       behavior_codes, exit_reasons, assessments
from public.v_lesson_window
where lesson_date = date '2026-09-01'
order by full_name;

-- Expect 10 rows. Учень 01 absent; variety of marks; some assessments JSON.

-- Outsiders (anon): after T-023A applied, anon must have no privileges.
-- select has_table_privilege('anon', 'public.v_lesson_window', 'select');
-- expect false after T-023A
