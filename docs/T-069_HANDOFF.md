# T-069 Handoff — in_journal (+ schedule review notes)

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261122000000_assessment_in_journal.sql`
- `supabase/seed_demo.sql`
- `supabase/tests/in_journal.sql` — DO blocks, no top-level PERFORM; negative cases isolated
- `supabase/tests/security.sql` — EXECUTE matrix + ops.keepalive checks restored
- `docs/SCHEDULE_DESIGN_REVIEW.md` — Owner decisions 2026-11-23
- `docs/T-069_HANDOFF.md`

VERIFIED:
- Static packaging by Grok only.
- **Not applied to live** by Grok.
- Claude previously dry-ran the migration on live with rollback (ACCEPTED logic).

DECISIONS:
- in_journal teacher-chosen; partial unique index
- Schedule: cancel like replace for plan/sequence; substitution under Owner journal; UI rule for absence vs grades

TODO:
1. Merge this PR after Claude re-check of tests/docs
2. Claude applies migration + seed_demo on live
3. No T-070+ SQL until contract v1.2 accepted

FILES: listed under CHANGED.
