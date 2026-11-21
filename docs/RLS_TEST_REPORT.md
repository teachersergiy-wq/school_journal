# RLS_TEST_REPORT — T-023B / post T-024

PROJECT: school_journal  
DB: `dtpyvyedcptdkdsowmco`  
T-023A applied: **YES**  
T-024 (board_exclusivity + assessment kinds + seed_demo): **YES**  
Tester: Claude  
Date: 2026-11-17  
Method: all checks in a transaction that was rolled back

## Summary

| Check | Expected | Result | Pass? |
|-------|----------|--------|-------|
| (a) Owner authenticated read/write + RPC | Works | v_lesson_window 2026-09-01: 10 rows; lesson_records: 50; independent+control grades: 2; save_lesson_record updates OK; control insert OK | YES |
| (a) Board exclusivity | XOR enforced | board_refused blocked when kind=board exists; kind=board blocked when board_refused; trigger OK | YES |
| (b) anon denied on tables/view/functions | Error or no access | v_lesson_window, save_lesson_record, assessments — all denied | YES |
| (c) Auth without profile | 0 rows, no writes | view, lesson_records, assessments — 0 rows; save_lesson_record blocked by RLS; assessment insert blocked by RLS | YES |
| (d) UPDATE profiles.role as authenticated | permission denied | permission denied for table profiles | YES |
| Static privileges | anon 0 SELECT; RLS all; policies authenticated | anon SELECT on 0 public objects; RLS on all tables; 31 policies TO authenticated | YES |
| Security Advisor | acceptable | only warning: compromised-password protection disabled (Free plan) | YES |
| EXECUTE hygiene | no PUBLIC/client EXECUTE on trigger fn | PUBLIC EXECUTE on `public.enforce_board_exclusivity` found; fixed by `20261118000000_revoke_trigger_fn_execute.sql` (not yet applied) | NO → pending T-006 |

## Notes

### Owner
- Lesson `2026-09-01` in `v_lesson_window`: 10 rows.
- `lesson_records`: 50.
- Assessments of kinds `independent` and `control`: 2.
- `save_lesson_record` updates a record: OK.
- Setting `board_refused` for a student who already has `kind=board`: blocked by trigger.
- Inserting `kind=board` for a student with `board_refused`: blocked by trigger.
- Inserting a control grade: OK.
- Changing `profiles.role`: `permission denied for table profiles`.

### anon
- `v_lesson_window`, `save_lesson_record`, `assessments`: all denied.

### User without profile (random UUID)
- View, `lesson_records`, `assessments`: 0 rows.
- `save_lesson_record`: blocked by RLS.
- Assessment insert: blocked by RLS.

### Static
- anon has SELECT on 0 public objects.
- RLS enabled on all tables.
- 31 policies, all `TO authenticated`.
- Security Advisor: only compromised-password protection warning.
- Finding: `EXECUTE` for `PUBLIC` on `enforce_board_exclusivity` — addressed by T-006 revoke migration (item 1 of this PR).

### Not tested
- Isolation between two teachers (no teacher accounts; T-050).
- HTTP Data API level with the public (anon) key.

## VERIFIED
Results above are Claude’s live checks on 2026-11-17. Grok recorded them into this file without re-running on live.

## TODO
- Apply T-006 revoke + keepalive after ACCEPTED+merge.
- Re-check function EXECUTE matrix (anon none; authenticated only `save_lesson_record`).
- Optional: HTTP-level anon key probes.
