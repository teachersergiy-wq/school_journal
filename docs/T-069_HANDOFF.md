# T-069 Handoff — in_journal

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261122000000_assessment_in_journal.sql`
- `supabase/seed_demo.sql` — multi-grade samples; one selected, one none
- `supabase/tests/in_journal.sql`
- `supabase/tests/security.sql` — EXECUTE matrix includes set/clear_journal_mark
- `docs/T-069_HANDOFF.md`

VERIFIED:
Static packaging only. **Not applied to live** by Grok.

DECISIONS:
Teacher alone chooses journal cell grade; partial unique index; no auto-pick; absent does not delete grades.

TODO:
Claude ACCEPTED → merge → apply migration → re-run seed_demo if needed → tests

FILES: listed under CHANGED.
