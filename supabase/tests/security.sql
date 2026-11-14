-- T-023A security checks (run as service role / SQL Editor after apply)

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

-- 4. Helpers live in private with pinned search_path
select n.nspname, p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'is_owner', 'is_journal_teacher', 'is_class_teacher', 'current_app_role',
  'handle_new_user', 'set_updated_at', 'prevent_profile_privilege_escalation'
)
order by 1, 2;

-- 5. No public copies of moved helpers
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_app_role', 'is_journal_teacher', 'is_class_teacher', 'is_owner');
-- expect: 0 rows

-- 6. Role change via SQL Editor (auth.uid null) should succeed for admin path
-- begin;
--   update public.profiles set role = 'owner' where id = '<some-uuid>';
-- rollback;

-- 7. authenticated must not have DELETE on profiles
select has_table_privilege('authenticated', 'public.profiles', 'delete') as auth_can_delete_profiles;
-- expect: false
