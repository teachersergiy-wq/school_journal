# T-024 Handoff — Synthetic demo journal data

PROJECT: school_journal

CHANGED:
- `supabase/seed_demo.sql`
- `supabase/seed_demo_cleanup.sql`
- `supabase/tests/seed_demo_verify.sql`
- `docs/T-024_HANDOFF.md`

VERIFIED:
- Only «Учень NN»; no hardcoded UUIDs/emails; owner via `profiles.role = 'owner'`
- Characteristics covered: н, homework 3 states, notebook/textbook, notes, board_refused, late, exits, behaviour, assessments current/thematic/board
- Not applied to live by Grok

DECISIONS: none new

TODO:
1. Claude review
2. Owner: owner profile + `seed.sql` if needed → `seed_demo.sql` → `tests/seed_demo_verify.sql`
3. After T-023A: confirm anon cannot select `v_lesson_window`
4. Later real data: run `seed_demo_cleanup.sql` first

FILES: listed above
