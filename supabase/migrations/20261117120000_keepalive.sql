-- T-006 keep-alive: Free-tier anti-pause via a real DB call (not Auth ping).
-- Schema ops is the only place anon may have privileges. public stays fully closed to anon.
-- Apply after assessment_kinds migration. Do not apply until ACCEPTED + merge.

create schema if not exists ops;

revoke all on schema ops from public;
-- authenticated: no USAGE on ops (keep-alive is for unauthenticated schedulers only)
revoke all on schema ops from authenticated;
grant usage on schema ops to anon;

create or replace function ops.keepalive()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from pg_catalog.pg_namespace;
$$;

revoke all on function ops.keepalive() from public;
revoke all on function ops.keepalive() from authenticated;
grant execute on function ops.keepalive() to anon;

comment on schema ops is
  'Ops-only schema for Free-tier keep-alive. No app tables. The only anon privilege outside a closed public.';
comment on function ops.keepalive() is
  'Anti-pause ping: returns count of namespaces. No app data. Call via PostgREST: GET /rest/v1/rpc/keepalive with schema ops exposed.';
