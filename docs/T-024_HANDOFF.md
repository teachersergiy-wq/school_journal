# T-024 Handoff — REWORK

PROJECT: school_journal

CHANGED:
- `supabase/seed_demo.sql` — board XOR fixed; topics `[ДЕМО] …`
- `supabase/seed_demo_cleanup.sql` — only `[ДЕМО]%` lessons; journal only if empty
- `supabase/migrations/20261114220000_board_exclusivity.sql`
- `docs/T-024_HANDOFF.md`

VERIFIED:
- Static only; not applied to live by Grok

DECISIONS:
- Demo lessons use topic prefix `[ДЕМО]`
- Board exclusivity enforced via trigger

TODO:
1. Claude re-review → ACCEPTED
2. Apply board_exclusivity migration, then seed_demo
3. Full starter wipe before real use is manual (see below)

## Full starter reset (manual)
1. `seed_demo_cleanup.sql`
2. Optionally delete students «Учень %» / unused class
3. Never commit real names

FILES: listed above
