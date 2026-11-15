# supabase/ — School Journal database

Owned by **Grok**.

- `migrations/` — ordered SQL migrations (apply with Supabase CLI or SQL editor).
- `seed.sql` — synthetic starter (marks, subjects, class 8-А, «Учень NN»).
- `seed_demo.sql` / `seed_demo_cleanup.sql` — demo journal lessons (topics `[ДЕМО] …`).
- `tests/` — security / RLS check scripts.

## Rules
- Free plan only.
- RLS enabled on every public table.
- No keys, passwords, service-role tokens in this folder or any commit.
- Schema follows `DATA_CONTRACT.md` in the repo root.
- Synthetic / demo data only in seeds; no real student names.

## Privileges (owner setting, 2026-11)
**Automatically expose new tables** is **disabled** in Supabase.
New tables and functions created by the `postgres` role get **no** default grants to `authenticated` or `service_role` (see `pg_default_acl`).

Therefore **every migration** that adds a table or a function the app must call must include:
1. Explicit `GRANT` to the roles that need them (usually `authenticated`; RPC as needed).
2. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` for tables.
3. Policies `TO authenticated` (owner/teacher rules as required).

Trigger-only functions do **not** need `GRANT EXECUTE` to clients.
Schema `private` must stay **out** of API exposed schemas.

## Status
- T-020 core schema: on main / applied historically.
- T-023A security hardening: merged path per project process.
- T-024 demo seed + board exclusivity: branch `grok/T-024`.
- T-023B RLS checks: branch `grok/T-023B`.
