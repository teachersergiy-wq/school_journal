# Apply checklist (after T-005)

Project: `dtpyvyedcptdkdsowmco` (eu-central-1, Free, ACTIVE_HEALTHY)

## Already done
- [x] Core schema migration applied (20261101190138)
- [x] save_lesson_record RPC applied (20261101190500)

## Next in SQL Editor
1. Apply `supabase/migrations/20261101215100_v_lesson_window.sql`
2. (Optional) Run `supabase/seed.sql` if not yet done
3. Smoke checks below

## Smoke checks (run as service role or owner in SQL Editor)

```sql
-- Tables exist
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;

-- Enums
select typname from pg_type
where typname in ('app_role','hw_status','exit_reason','assessment_kind');

-- RLS on
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- Seed (if applied)
select count(*) as behavior_marks from public.behavior_marks;
select count(*) as subjects from public.subjects;
select count(*) as classes from public.classes;
select count(*) as students from public.students;
```

## RLS quick test (after you create a test teacher profile)
1. Create a user in Auth, insert matching row into `profiles` with role `teacher`.
2. Create a journal for that teacher.
3. As that user (anon key + JWT): should see only own journals; other teachers' data must be empty.
