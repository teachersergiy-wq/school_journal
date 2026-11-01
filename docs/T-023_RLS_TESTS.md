# T-023 — RLS smoke tests (manual)

Project: `dtpyvyedcptdkdsowmco`  
Run in SQL Editor as **service role / postgres** unless noted.

## Preconditions
1. Core schema + RPC + `v_lesson_window` + `handle_new_user` applied.
2. At least one Auth user exists; corresponding `profiles` row exists.
3. One user promoted to `owner`.
4. Optional: second Auth user left as `teacher`.

## A. Structure checks (any role with SQL access)

```sql
-- All expected tables
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;
-- expect: assessments, behavior_marks, classes, journals, lesson_exits,
--         lesson_record_behavior, lesson_records, lessons, profiles, students, subjects

-- RLS enabled
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
-- every row: relrowsecurity = true

-- Policies exist
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by 1, 2;
```

## B. Owner sees everything

As owner (or service role):

```sql
select count(*) from public.classes;
select count(*) from public.students;
select count(*) from public.journals;
select count(*) from public.lessons;
```

## C. Teacher isolation (needs 2 users)

1. User A = owner (or teacher of journal J1).
2. User B = teacher with **no** journals (or only journal J2).

From the **app** (or SQL with JWT of B):

- B must get **0 rows** from `journals` that belong to A.
- B must not see `lesson_records` / `assessments` of A’s lessons.

## D. Absent constraint

```sql
-- Should FAIL (check constraint)
-- insert a lesson_record with is_absent=true and homework set
-- (only after you have real lesson_id + student_id)
```

## E. save_lesson_record RPC

Call via PostgREST / client as teacher of the journal; must succeed for own journal and fail (RLS) for another teacher’s lesson.

## Pass criteria
- [ ] All tables present, RLS on
- [ ] Owner can read directories
- [ ] Teacher cannot read other teachers’ journals/records (verified from client)
- [ ] Absent constraint rejects illegal combinations
- [ ] RPC works for own journal only

Mark T-023 ACCEPTED when the checklist above is ticked by owner/Claude.
