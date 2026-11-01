-- T-023A security checks (run as postgres / service role after migration)
-- Record pass/fail manually on live after ACCEPTED apply.

-- 1. anon has no table privileges
select c.relname, has_table_privilege('anon', c.oid, 'select') as anon_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v')
order by 1;
-- expect: all anon_select = false

-- 2. RLS still on
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
-- expect: all true

-- 3. Policies are TO authenticated (roles_to in pg_policies)
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
order by 1, 2;

-- 4. search_path pinned on key functions
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at','current_app_role','is_owner','is_journal_teacher',
    'is_class_teacher','handle_new_user','prevent_profile_privilege_escalation','save_lesson_record'
  )
order by 1;
-- expect: proconfig contains search_path=public

-- 5. Role escalation blocked (run inside a transaction as a non-owner JWT if available)
-- begin;
--   -- set role / jwt to a teacher profile if one exists
--   update public.profiles set role = 'owner' where id = auth.uid();
--   -- expect exception
-- rollback;
