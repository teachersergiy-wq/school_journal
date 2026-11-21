-- T-006 keep-alive: Free-tier anti-pause via a real DB call (not Auth ping).
-- Schema ops is the only place anon may have privileges. public stays fully closed to anon.
-- IMPORTANT: revoke EXECUTE from PUBLIC — PostgreSQL grants EXECUTE on new functions to PUBLIC by default;
-- alter default privileges in schema does not cancel that.

create schema if not exists ops;

revoke all on schema ops from public;
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
  'Ops-only schema for Free-tier keep-alive. No app tables. The only intentional anon privilege outside a closed public.';
comment on function ops.keepalive() is
  'Anti-pause ping: returns count of namespaces. No app data. Expose schema ops in Data API; call RPC keepalive.';
