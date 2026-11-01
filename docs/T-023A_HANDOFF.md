# T-023A Handoff — Security hardening (teacher-ready)

PROJECT: school_journal  
CHANGED: Rewrote migration for **teacher-ready** single-user (correct archive 2026-11-02). Previous owner-only-only version discarded.  
VERIFIED: Matches Hub T-023A card: keep owner+teacher policies; private schema helpers; strip anon; block role escalation. **Not applied** to live.  
DECISIONS: none new.  
TODO: Claude review → ACCEPTED; then apply; T-023B; Owner T-007.  
FILES:
- supabase/migrations/20261101232000_security_hardening.sql (authoritative)
- supabase/migrations/20261101230224_security_hardening.sql (superseded stub)
- supabase/tests/security.sql
- docs/T-023A_HANDOFF.md

## Note on prior mistake
An earlier incomplete Hub zip described owner-only RLS. The authoritative decision is **variant A: single user now, ready for several teachers** — teacher policies must remain.
