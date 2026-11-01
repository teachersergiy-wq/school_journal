# Next steps — after schema applied

Project: `dtpyvyedcptdkdsowmco` (eu-central-1, Free)

## 1. Apply remaining migrations (SQL Editor)

In order:

1. `supabase/migrations/20261101215100_v_lesson_window.sql`
2. `supabase/migrations/20261101220000_handle_new_user.sql`  ← NEW
3. (optional) `supabase/seed.sql`

## 2. Merge PR #1

https://github.com/teachersergiy-wq/school_journal/pull/1  
`grok/T-020` → `main`

## 3. Create first owner (one-time)

After you sign up the first user in Auth (email or magic link):

```sql
-- Find the user id
select id, email from auth.users order by created_at desc limit 5;

-- Promote to owner (replace UUID)
update public.profiles
set role = 'owner', display_name = 'Власник'
where id = 'PASTE-USER-UUID-HERE';
```

## 4. Smoke RLS (T-023 light)

As owner in SQL Editor you see everything.  
As a second teacher user (JWT) you must see only journals where `teacher_id = auth.uid()`.

## 5. Free-plan keep-alive (T-006 related)

Project pauses after ~7 days of inactivity.  
Options:
- Weekly GitHub Action that hits a tiny Edge Function or REST endpoint
- Or manual resume from dashboard when needed

No paid services.

## 6. Backup (T-043)

Free plan has no daily backups.  
Schedule periodic `pg_dump` / Supabase CLI export to a private place (or GitHub artifact).
