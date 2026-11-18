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
New tables and functions created by the `postgres` role get **no** default grants to `authenticated` or `service_role` via `pg_default_acl` in schema — **but** PostgreSQL still grants **`EXECUTE` to `PUBLIC` on every new function**. `ALTER DEFAULT PRIVILEGES IN SCHEMA …` does **not** remove that global default.

Therefore **every migration** that adds a table or a function must include:
1. For **functions**: explicit `REVOKE ALL ON FUNCTION … FROM PUBLIC` (and from `anon` / `authenticated` as needed), then **only** the `GRANT EXECUTE` that is required (if any). Trigger-only functions need **no** client `GRANT EXECUTE`.
2. For **tables**: explicit `GRANT` to the roles that need them, `ENABLE ROW LEVEL SECURITY`, and policies `TO authenticated`.
3. Schema `private` must stay **out** of API exposed schemas.

### Exception: schema `ops` (T-006 keep-alive)
By default **anon has no privileges** on `public` or `private`.

The only intentional exception is schema **`ops`** with a single function `ops.keepalive()`:
- Purpose: Free-tier anti-pause. Supabase counts **database** activity; Auth pings do not count.
- Design: function lives in **`ops`**, not `public`, so we never grant `USAGE` on `public` to `anon`.
- Body: `security invoker`, `search_path = ''`, reads only `pg_catalog.pg_namespace` (no app data).
- Privileges: after `REVOKE ALL … FROM PUBLIC`, `anon` has `USAGE` on `ops` and `EXECUTE` on `ops.keepalive()` only. **No** tables in `ops`. **No** grants to `authenticated` on `ops`.
- After apply: owner adds **`ops`** to Data API exposed schemas so PostgREST can call the RPC from a scheduler.

**Remove the exception:**
```sql
drop schema ops cascade;
```
Then remove `ops` from Settings → API → Exposed schemas.

## Status
- T-020 core schema: applied historically.
- T-023A security hardening: applied on live (2026-11-14).
- T-024 board exclusivity + assessment kinds + seed_demo: applied on live (2026-11-17).
- T-006 keep-alive + revoke trigger EXECUTE: branch `grok/T-006-keepalive` (not applied until ACCEPTED).
