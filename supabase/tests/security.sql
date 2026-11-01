-- T-023A security checks (after ACCEPTED apply, as service role)
select c.relname, has_table_privilege('anon', c.oid, 'select') as anon_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v') order by 1;

select c.relname, c.relrowsecurity from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

select tablename, policyname, roles from pg_policies where schemaname = 'public' order by 1, 2;

select n.nspname, p.proname, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('is_owner','is_journal_teacher','is_class_teacher','current_app_role','handle_new_user','set_updated_at','prevent_profile_privilege_escalation')
order by 1, 2;

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('current_app_role','is_journal_teacher','is_class_teacher','is_owner');
