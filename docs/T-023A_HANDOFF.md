# T-023A Handoff — Security hardening (single-user)

PROJECT: school_journal  
CHANGED: forward migration `supabase/migrations/20261101230224_security_hardening.sql` + `supabase/tests/security.sql`  
VERIFIED: written against Claude review 2026-11-02 and owner single-user decision. **Not applied** to live `dtpyvyedcptdkdsowmco`.  
DECISIONS: none new; implements single-user (owner only).  
TODO:
- Claude: review PR → ACCEPTED or REWORK
- Owner: T-007 disable public signup
- After ACCEPTED: apply migration on live, run tests/security.sql, then T-023B
FILES:
- supabase/migrations/20261101230224_security_hardening.sql
- supabase/tests/security.sql
- docs/T-023A_HANDOFF.md

## What the migration does
A. Revokes all from `anon`/`PUBLIC` on public tables/views/sequences; grants needed rights to `authenticated` only.  
B. Blocks `profiles.role` / `id` changes for non-owner (trigger + column grants). No INSERT on profiles for authenticated.  
C. Drops old policies; recreates `TO authenticated` with `is_owner()` checks.  
D. Pins `search_path = public` on functions; revokes EXECUTE of sensitive funcs from anon/public.  
E. Ensures `v_lesson_window` has no anon access.

## Intentionally kept
- `teacher` still in `app_role` enum (dormant).  
- `is_journal_teacher` / `is_class_teacher` remain (future multi-user); not granted to anon.  
- `handle_new_user` SECURITY DEFINER for Auth trigger; EXECUTE revoked from client roles.
