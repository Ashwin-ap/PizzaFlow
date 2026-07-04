-- PizzaFlow / SliceMatic Stage 3 — 0005_harden_rpc_grants.sql
-- Corrective/hardening migration. 0003 & 0004 (as first applied) revoked EXECUTE only
-- from PUBLIC, which does NOT remove Supabase's default per-role grants — so anon could
-- still call create_order()/check_rate_limit() via PostgREST RPC. This revokes EXECUTE
-- from anon and authenticated by name. Idempotent (revoking an absent grant is a no-op).
revoke execute on function create_order(jsonb)                    from anon, authenticated;
revoke execute on function check_rate_limit(text, int, int)       from anon, authenticated;
grant  execute on function create_order(jsonb)                    to service_role;
grant  execute on function check_rate_limit(text, int, int)       to service_role;
