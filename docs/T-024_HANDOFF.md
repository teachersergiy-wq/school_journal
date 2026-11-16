# T-024 Handoff

PROJECT: school_journal

CHANGED:
- `supabase/migrations/20261114220000_board_exclusivity.sql` — board grade XOR board_refused
- `supabase/migrations/20261117010000_assessment_kinds_independent_control.sql` — enum `independent` AFTER `current`, `control` AFTER `independent`
- `supabase/seed_demo.sql` — [ДЕМО] lessons; aborts if non-demo lessons exist; sample current/independent/control/thematic/board (board XOR preserved)
- `supabase/seed_demo_cleanup.sql` — only topics `[ДЕМО]%`; empty journal only if no lessons left
- `supabase/tests/seed_demo_verify.sql`
- `supabase/README.md` — explicit GRANT/RLS when auto-expose is off
- `docs/T-024_HANDOFF.md`

VERIFIED:
- Static review only. **Not applied** to live by Grok.

DECISIONS:
- Demo lessons marked `[ДЕМО]`
- Board grade XOR `board_refused` via trigger
- Assessment kind order: current → independent → control → thematic → board

TODO:
1. Claude ACCEPTED → merge PR
2. Owner permission → Claude applies **in this order**:
   1. `20261114220000_board_exclusivity.sql`
   2. `20261117010000_assessment_kinds_independent_control.sql`
   3. `supabase/seed_demo.sql`
   4. `supabase/tests/seed_demo_verify.sql` (+ T-023B checks)
3. Before real school data: full starter reset below if needed

## Full starter reset (before real school data)
`seed_demo_cleanup.sql` does **not** remove class 8-А or synthetic students from `seed.sql`.

Manual order (SQL Editor, service role; only fictional data):
1. Run `supabase/seed_demo_cleanup.sql`.
2. Optional — remove starter pupils and class if unused:
```sql
delete from public.students
where full_name like 'Учень %'
  and class_id in (
    select id from public.classes
    where grade = 8 and letter = 'А' and school_year = 2026
  );

delete from public.classes
where grade = 8 and letter = 'А' and school_year = 2026
  and not exists (select 1 from public.students s where s.class_id = classes.id)
  and not exists (select 1 from public.journals j where j.class_id = classes.id);
```
3. Never insert real pupil names into the public repository.

FILES: listed under CHANGED.
