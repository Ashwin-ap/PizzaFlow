-- PizzaFlow / SliceMatic Stage 3 — 0004_ratelimit.sql
-- Durable per-IP rate limiter (PRD §11.5, §17). Serverless functions share no
-- in-process memory, so the counter lives in Postgres. Fixed-window: the key is
-- `${route}:${ip}` and the window bucket is floor(epoch / window_seconds).
-- General limit ~100/60s; POST /api/orders ~10/60s.

create table rate_limits (
  key    text   not null,
  bucket bigint not null,   -- floor(epoch / window_seconds)
  count  int    not null default 0,
  primary key (key, bucket)
);

-- Locked down: no policies, and only the SECURITY DEFINER function (below) or the
-- service role touch it. Not user data.
alter table rate_limits enable row level security;

create or replace function check_rate_limit(
  p_key text, p_limit int, p_window_seconds int
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  cur_bucket bigint := floor(extract(epoch from now()) / p_window_seconds);
  new_count  int;
begin
  insert into rate_limits (key, bucket, count)
  values (p_key, cur_bucket, 1)
  on conflict (key, bucket) do update set count = rate_limits.count + 1
  returning count into new_count;

  -- Opportunistic cleanup of this key's stale windows so the table stays small.
  delete from rate_limits where key = p_key and bucket < cur_bucket;

  return new_count <= p_limit;
end;
$$;

-- Revoke from anon/authenticated by name — Supabase grants EXECUTE to them by default,
-- so revoking from PUBLIC alone leaves those grants in place.
revoke execute on function check_rate_limit(text, int, int) from public, anon, authenticated;
grant  execute on function check_rate_limit(text, int, int) to service_role;
