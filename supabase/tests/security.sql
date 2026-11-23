-- Security checks (T-023A + T-006 + T-069) — service role / SQL Editor after apply

-- 1. anon has no SELECT on public tables/views
select c.relname, has_table_privilege('anon', c.oid, 'select') as anon_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v')
order by 1;
-- expect: all anon_select = false

-- 2. RLS enabled
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
-- expect: all true

-- 3. Policies target authenticated
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
order by 1, 2;

-- 4. Helpers
select n.nspname, p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'is_owner', 'is_journal_teacher', 'is_class_teacher', 'current_app_role',
  'handle_new_user', 'set_updated_at', 'prevent_profile_privilege_escalation',
  'enforce_board_exclusivity', 'set_journal_mark', 'clear_journal_mark'
)
order by 1, 2;

-- 5. No public copies of moved helpers
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_app_role', 'is_journal_teacher', 'is_class_teacher', 'is_owner');
-- expect: 0 rows

-- 6. authenticated must not have DELETE on profiles
select has_table_privilege('authenticated', 'public.profiles', 'delete') as auth_can_delete_profiles;
-- expect: false

-- 7. public functions: anon EXECUTE none;
--    authenticated EXECUTE only: save_lesson_record, set_journal_mark, clear_journal_mark
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
order by 1;
-- expect: anon_exec all false;
--         auth_exec true only for save_lesson_record, set_journal_mark, clear_journal_mark

-- ============================================================
-- T-006 keep-alive (ops schema)
-- ============================================================

-- 8. anon USAGE: only ops (not public, not private)
select
  has_schema_privilege('anon', 'public', 'usage') as anon_public_usage,
  has_schema_privilege('anon', 'private', 'usage') as anon_private_usage,
  has_schema_privilege('anon', 'ops', 'usage') as anon_ops_usage;
-- expect: false, false, true

-- 9. ops: exactly one function, zero tables
select count(*) as ops_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ops';
-- expect: 1

select count(*) as ops_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ops' and c.relkind = 'r';
-- expect: 0

-- 10. authenticated has no privileges on ops
select
  has_schema_privilege('authenticated', 'ops', 'usage') as auth_ops_usage,
  has_function_privilege('authenticated', 'ops.keepalive()', 'execute') as auth_keepalive_exec;
-- expect: false, false

-- 11. The only function anon may execute is ops.keepalive (not any public fn)
select n.nspname, p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where has_function_privilege('anon', p.oid, 'execute')
  and n.nspname in ('public', 'private', 'ops')
order by 1, 2;
-- expect: only ops.keepalive

-- 12. anon calling ops.keepalive() returns an integer
begin;
  set local role anon;
  select ops.keepalive() as keepalive_result;
  -- expect: integer >= 1
rollback;
