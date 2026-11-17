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

### Exception: schema `ops` (T-006 keep-alive)
By default **anon has no privileges** on `public` or `private`.

The only intentional exception is schema **`ops`** with a single function `ops.keepalive()`:
- Purpose: Free-tier anti-pause. Supabase counts **database** activity; Auth pings do not count.
- Design: function lives in **`ops`**, not `public`, so we never grant `USAGE` on `public` to `anon`.
- Body: `security invoker`, `search_path = ''`, reads only `pg_catalog.pg_namespace` (no app data).
- Privileges: `anon` has `USAGE` on `ops` and `EXECUTE` on `ops.keepalive()` only. **No** tables in `ops`. **No** grants to `authenticated` on `ops`.
- After apply: owner must add **`ops`** to Data API exposed schemas so PostgREST can call the RPC from a scheduler (e.g. GitHub Actions `curl` to `/rest/v1/rpc/keepalive`).

**Remove the exception (if keep-alive is no longer needed):**
```sql
drop schema ops cascade;
```
Then remove `ops` from Settings → API → Exposed schemas.

## Status
- T-020 core schema: on main / applied historically.
- T-023A security hardening: applied on live (2026-11-14).
- T-024 / assessment kinds: see open PRs (must land before this migration on a clean timeline).
- T-006 keep-alive: branch `grok/T-006-keepalive` (not applied until ACCEPTED).
