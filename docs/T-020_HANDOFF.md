# T-020 Handoff — Core schema

PROJECT: school_journal
CHANGED: supabase/ core schema + RLS + seed + save_lesson_record RPC
VERIFIED: SQL written against ACCEPTED DATA_CONTRACT (2026-11-01). Not yet applied to a live Supabase project (T-005 still open).
DECISIONS: none new; followed Q1–Q5 answers.
TODO:
- Owner/Claude: ACCEPT this PR after review
- T-005: create free Supabase project → apply migrations
- T-021 / T-023: journal refinements + RLS tests once project exists
- T-024: richer seed after first teacher profile
FILES:
- supabase/migrations/20261101190138_core_schema.sql
- supabase/migrations/20261101190500_save_lesson_record_rpc.sql
- supabase/seed.sql
- supabase/README.md
