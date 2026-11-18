# T-006 Handoff — keepalive + EXECUTE hygiene

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261118000000_revoke_trigger_fn_execute.sql`
- `supabase/migrations/20261118000100_keepalive.sql`
- `supabase/tests/security.sql`
- `supabase/tests/rls_checks.sql`
- `supabase/README.md`
- `docs/RLS_TEST_REPORT.md` (Claude 2026-11-17 results)
- `docs/T-006_HANDOFF.md`

VERIFIED:
- Static packaging only. **Not applied to live** by Grok.
- Live behavioural results in RLS_TEST_REPORT are Claude’s (2026-11-17), not re-run by Grok.

DECISIONS:
- Owner 2026-11-17: keep-alive via `ops.keepalive()`.
- Always `REVOKE ALL … FROM PUBLIC` on new functions (global EXECUTE default).

TODO:
1. Claude ACCEPTED → merge
2. Claude applies both migrations on live
3. Owner adds schema `ops` to Data API exposed schemas
4. Scheduler (Actions) to call RPC — separate task

FILES: listed under CHANGED.
