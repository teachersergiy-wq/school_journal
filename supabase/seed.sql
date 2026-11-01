-- Synthetic seed for School Journal (T-020 / T-024)
-- ONLY fictional data. No real names.
-- Apply after migrations. Safe to re-run after truncate (order matters).

-- Behavior marks (ACCEPTED 6)
insert into public.behavior_marks (code, label, is_positive) values
  ('disrupts',   'Заважає',              false),
  ('talks',      'Розмовляє',            false),
  ('uses_phone', 'Користується телефоном', false),
  ('rude',       'Грубість',             false),
  ('active',     'Активна участь',       true),
  ('helps',      'Допомагає іншим',      true)
on conflict (code) do nothing;

-- Subjects
insert into public.subjects (name) values
  ('Алгебра'),
  ('Українська мова')
on conflict (name) do nothing;

-- One class: 8-А, 2026/27
insert into public.classes (grade, letter, school_year)
values (8, 'А', 2026)
on conflict (grade, letter, school_year) do nothing;

-- 10 synthetic students
insert into public.students (class_id, full_name)
select c.id, n.full_name
from public.classes c
cross join (values
  ('Учень 01'),
  ('Учень 02'),
  ('Учень 03'),
  ('Учень 04'),
  ('Учень 05'),
  ('Учень 06'),
  ('Учень 07'),
  ('Учень 08'),
  ('Учень 09'),
  ('Учень 10')
) as n(full_name)
where c.grade = 8 and c.letter = 'А' and c.school_year = 2026
  and not exists (
    select 1 from public.students s
    where s.class_id = c.id and s.full_name = n.full_name
  );

-- NOTE: profiles, journals, lessons, records, assessments
-- require real auth.users ids. They are created after the first
-- teacher signs up (or via a one-time admin script with service role).
-- Do NOT put service-role keys or real user ids in this file.

comment on table public.behavior_marks is 'Seeded with 6 ACCEPTED marks; owner can add more';
