# T-023A Handoff — Security hardening (teacher-ready)

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261101232000_security_hardening.sql` (fixed after live review)
- `supabase/tests/security.sql`
- `docs/T-023A_HANDOFF.md`

VERIFIED:
- Drop policies **before** dropping public helpers (fixes dependency failure).
- Trigger allows role change when `auth.uid()` is null (SQL Editor / service role).
- `set_updated_at` is SECURITY INVOKER + pinned `search_path` only.
- `DELETE` revoked on `profiles` for `authenticated`.
- Teacher policies kept (teacher-ready).
- **Not applied** to live `dtpyvyedcptdkdsowmco`.

DECISIONS: none new; implements 2026-11-02 variant A.

TODO:
1. Claude: ACCEPTED or REWORK
2. Owner: T-007 disable public signup; confirm Settings → API does **not** expose schema `private`
3. After ACCEPTED: apply migration, run `supabase/tests/security.sql`, then T-023B
4. T-024: add demo journals + lessons (currently 0 on live)

FILES: see above.

## Owner: change role via SQL Editor
```sql
update public.profiles set role = 'owner' where id = '<auth-user-uuid>';
```
Works because trigger allows when `auth.uid()` is null.
