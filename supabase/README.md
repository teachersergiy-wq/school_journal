# supabase/ — School Journal database

Owned by **Grok**.

- `migrations/` — ordered SQL migrations (apply with Supabase CLI or SQL editor).
- `seed.sql` — synthetic data only (no real student names).

## Rules
- Free plan only.
- RLS enabled on every public table.
- No keys, passwords, service-role tokens in this folder or any commit.
- Schema follows `DATA_CONTRACT.md` in the repo root.

## Status
- T-020 core schema: present.
- T-021 journal extras / RPC: next.
- T-023 RLS refinements + tests: after project exists.
- T-024 richer seed: after first teacher profile exists.
