# T-024 Handoff

PROJECT: school_journal

CHANGED:
- `supabase/seed_demo.sql` — refuses journals with non-demo lessons; never rewrites non-demo topics
- `supabase/seed_demo_cleanup.sql` — only `[ДЕМО]%` lessons
- `supabase/migrations/20261114220000_board_exclusivity.sql`
- `supabase/README.md` — explicit GRANT/RLS rule for new objects
- `docs/T-024_HANDOFF.md`

VERIFIED:
- Static review only (Claude accepted logic at 95c6692; this polish not executed on live by Grok).
- **Not applied** to live database.

DECISIONS:
- Demo lessons use topic prefix `[ДЕМО]`
- Board grade XOR `board_refused` enforced by trigger

TODO:
1. Claude ACCEPTED → merge
2. Owner permission → Claude applies `board_exclusivity`, then `seed_demo.sql`, then T-024/T-023B checks
3. Before real use: full starter reset below if needed

## Full starter reset (before real school data)
`seed_demo_cleanup.sql` does **not** remove class 8-А or synthetic students from `seed.sql`.

Manual order (SQL Editor, service role; only fictional data):
1. Run `supabase/seed_demo_cleanup.sql` (demo lessons / empty journal).
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
