# RLS_TEST_REPORT — T-023B

PROJECT: school_journal  
DB: `dtpyvyedcptdkdsowmco`  
T-023A applied: **NO / YES** (fill after Claude applies)  
T-024 demo data: **NO / YES**  
Tester:  
Date:

## Summary

| Check | Expected | Result | Pass? |
|-------|----------|--------|-------|
| (a) Owner authenticated read/write + RPC | Works | | |
| (b) anon denied on tables/view/functions | Error or no access | | |
| (c) Auth without profile | 0 rows, no writes | | |
| (d) UPDATE profiles.role as authenticated | permission denied (column role) | | |
| (e) v_lesson_window owner vs stranger | owner >0; stranger 0 | | |

## Notes
(paste errors / counts per section)

## VERIFIED
Only checks actually run are marked Pass. Scripts prepared by Grok; live execution after T-023A apply.

## TODO
- Claude applies T-023A after ACCEPTED+merge
- Run `supabase/tests/rls_checks.sql`, fill this report
- ACCEPTED T-023B
