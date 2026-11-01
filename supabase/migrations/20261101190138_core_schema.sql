-- T-020 Core schema for School Journal (stage 1: journal)
-- Based on ACCEPTED DATA_CONTRACT.md (2026-11-01)
-- Free plan only. RLS on every public table. Synthetic data only.

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('owner', 'teacher');
create type public.hw_status as enum ('done', 'partial', 'not_done');
create type public.exit_reason as enum ('toilet', 'phone', 'other');
create type public.assessment_kind as enum ('current', 'thematic', 'board');

-- ============================================================
-- TABLES
-- ============================================================

-- 4.1 profiles (1-1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.2 classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade between 1 and 11),
  letter text check (letter is null or char_length(letter) = 1),
  school_year smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade, letter, school_year)
);

-- 4.3 students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_class_id_idx on public.students (class_id);

-- 4.4 subjects
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.5 journals (subject + class + teacher)
create table public.journals (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, subject_id, teacher_id)
);
create index journals_teacher_id_idx on public.journals (teacher_id);
create index journals_class_id_idx on public.journals (class_id);

-- 4.6 lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  lesson_date date not null,
  lesson_number smallint not null default 1 check (lesson_number between 1 and 10),
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, lesson_date, lesson_number)
);
create index lessons_journal_id_idx on public.lessons (journal_id);
create index lessons_date_idx on public.lessons (lesson_date);

-- 4.7 behavior_marks (dictionary)
create table public.behavior_marks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_positive boolean not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.8 lesson_records
create table public.lesson_records (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  is_absent boolean not null default false,
  homework public.hw_status,
  has_notebook boolean,
  has_textbook boolean,
  not_taking_notes boolean,
  board_refused boolean not null default false,
  late_minutes smallint check (late_minutes is null or (late_minutes between 1 and 90)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id),
  -- when absent, other marks must be null / false
  constraint lesson_records_absent_clears_marks check (
    not is_absent
    or (
      homework is null
      and has_notebook is null
      and has_textbook is null
      and not_taking_notes is null
      and board_refused = false
      and late_minutes is null
    )
  )
);
create index lesson_records_lesson_id_idx on public.lesson_records (lesson_id);
create index lesson_records_student_id_idx on public.lesson_records (student_id);

-- 4.9 lesson_record_behavior (M:N)
create table public.lesson_record_behavior (
  record_id uuid not null references public.lesson_records (id) on delete cascade,
  mark_id uuid not null references public.behavior_marks (id) on delete restrict,
  primary key (record_id, mark_id)
);

-- 4.10 lesson_exits
create table public.lesson_exits (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.lesson_records (id) on delete cascade,
  reason public.exit_reason not null,
  created_at timestamptz not null default now()
);
create index lesson_exits_record_id_idx on public.lesson_exits (record_id);

-- 4.11 assessments
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  value smallint not null check (value between 1 and 12),
  kind public.assessment_kind not null default 'current',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_lesson_id_idx on public.assessments (lesson_id);
create index assessments_student_id_idx on public.assessments (student_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create trigger journals_updated_at before update on public.journals
  for each row execute function public.set_updated_at();
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();
create trigger behavior_marks_updated_at before update on public.behavior_marks
  for each row execute function public.set_updated_at();
create trigger lesson_records_updated_at before update on public.lesson_records
  for each row execute function public.set_updated_at();
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();

-- ============================================================
-- Helper: current user's role
-- ============================================================
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: is the current user the teacher of a journal?
create or replace function public.is_journal_teacher(j_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journals
    where id = j_id and teacher_id = auth.uid()
  );
$$;

-- Helper: is the current user teacher of any journal for this class?
create or replace function public.is_class_teacher(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.journals
    where class_id = c_id and teacher_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.journals enable row level security;
alter table public.lessons enable row level security;
alter table public.behavior_marks enable row level security;
alter table public.lesson_records enable row level security;
alter table public.lesson_record_behavior enable row level security;
alter table public.lesson_exits enable row level security;
alter table public.assessments enable row level security;

-- profiles
create policy "profiles_select_own_or_owner"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.current_app_role() = 'owner'
  );
create policy "profiles_insert_owner"
  on public.profiles for insert
  with check (public.current_app_role() = 'owner' or id = auth.uid());
create policy "profiles_update_own_or_owner"
  on public.profiles for update
  using (id = auth.uid() or public.current_app_role() = 'owner');
create policy "profiles_delete_owner"
  on public.profiles for delete
  using (public.current_app_role() = 'owner');

-- classes
create policy "classes_select_owner_or_related_teacher"
  on public.classes for select
  using (
    public.current_app_role() = 'owner'
    or public.is_class_teacher(id)
  );
create policy "classes_write_owner"
  on public.classes for all
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- students
create policy "students_select_owner_or_related_teacher"
  on public.students for select
  using (
    public.current_app_role() = 'owner'
    or public.is_class_teacher(class_id)
  );
create policy "students_write_owner"
  on public.students for all
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- subjects
create policy "subjects_select_authenticated"
  on public.subjects for select
  using (auth.uid() is not null);
create policy "subjects_write_owner"
  on public.subjects for all
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- behavior_marks
create policy "behavior_marks_select_authenticated"
  on public.behavior_marks for select
  using (auth.uid() is not null);
create policy "behavior_marks_write_owner"
  on public.behavior_marks for all
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- journals
create policy "journals_select_own_or_owner"
  on public.journals for select
  using (
    teacher_id = auth.uid()
    or public.current_app_role() = 'owner'
  );
create policy "journals_write_owner"
  on public.journals for all
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- lessons (teacher of the journal)
create policy "lessons_select_own_or_owner"
  on public.lessons for select
  using (
    public.current_app_role() = 'owner'
    or public.is_journal_teacher(journal_id)
  );
create policy "lessons_insert_own_or_owner"
  on public.lessons for insert
  with check (
    public.current_app_role() = 'owner'
    or public.is_journal_teacher(journal_id)
  );
create policy "lessons_update_own_or_owner"
  on public.lessons for update
  using (
    public.current_app_role() = 'owner'
    or public.is_journal_teacher(journal_id)
  );
create policy "lessons_delete_own_or_owner"
  on public.lessons for delete
  using (
    public.current_app_role() = 'owner'
    or public.is_journal_teacher(journal_id)
  );

-- lesson_records
create policy "lesson_records_select_own_or_owner"
  on public.lesson_records for select
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lesson_records_insert_own_or_owner"
  on public.lesson_records for insert
  with check (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lesson_records_update_own_or_owner"
  on public.lesson_records for update
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lesson_records_delete_own_or_owner"
  on public.lesson_records for delete
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );

-- lesson_record_behavior
create policy "lrb_select_own_or_owner"
  on public.lesson_record_behavior for select
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lrb_insert_own_or_owner"
  on public.lesson_record_behavior for insert
  with check (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lrb_delete_own_or_owner"
  on public.lesson_record_behavior for delete
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );

-- lesson_exits
create policy "lesson_exits_select_own_or_owner"
  on public.lesson_exits for select
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lesson_exits_insert_own_or_owner"
  on public.lesson_exits for insert
  with check (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "lesson_exits_delete_own_or_owner"
  on public.lesson_exits for delete
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1
      from public.lesson_records lr
      join public.lessons l on l.id = lr.lesson_id
      where lr.id = record_id and public.is_journal_teacher(l.journal_id)
    )
  );

-- assessments
create policy "assessments_select_own_or_owner"
  on public.assessments for select
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "assessments_insert_own_or_owner"
  on public.assessments for insert
  with check (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "assessments_update_own_or_owner"
  on public.assessments for update
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );
create policy "assessments_delete_own_or_owner"
  on public.assessments for delete
  using (
    public.current_app_role() = 'owner'
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_journal_teacher(l.journal_id)
    )
  );

-- ============================================================
-- Comments (documentation)
-- ============================================================
comment on table public.profiles is 'App profiles linked 1:1 to auth.users; role owner|teacher';
comment on table public.journals is 'One journal = subject + class + single teacher';
comment on table public.lesson_records is 'Per-student characteristics on a lesson; is_absent = н';
comment on column public.lesson_records.board_refused is 'Refusal to work at the board; mutually exclusive with assessments.kind=board';
comment on table public.assessments is 'Grades 1-12; kind current|thematic|board';
