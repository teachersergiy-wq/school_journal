# T-006 Handoff — ops.keepalive()

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261117120000_keepalive.sql`
- `supabase/tests/security.sql` — ops privilege checks
- `supabase/tests/rls_checks.sql` — section (b2) keepalive
- `supabase/README.md` — documented anon exception
- `docs/T-006_HANDOFF.md`

VERIFIED:
- Static design only. **Not applied to live** by Grok.
- No local Postgres execution in this delivery.

DECISIONS:
- Owner 2026-11-17: keep-alive via tiny DB function (not Auth ping).
- Schema `ops` so `public` stays fully closed to `anon`.

TODO:
1. Claude review → ACCEPTED → merge
2. Ensure PR #5 (enum AFTER) and PR #6 are merged/applied as required before/alongside project order
3. Claude applies `20261117120000_keepalive.sql`
4. Owner adds schema `ops` to Data API exposed schemas
5. Wire scheduler (GitHub Actions) to call RPC (separate ops task)

FILES: listed under CHANGED.
