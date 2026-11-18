-- T-006 hygiene: trigger functions do not need client EXECUTE.
-- PUBLIC still gets EXECUTE on new functions by default in PostgreSQL;
-- alter default privileges in schema does not remove that global default.
-- Revoke from public, anon, and authenticated. Triggers keep working
-- (privilege is checked at CREATE TRIGGER time, not at row fire time).

revoke all on function public.enforce_board_exclusivity() from public, anon, authenticated;
