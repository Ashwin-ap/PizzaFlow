-- PizzaFlow / SliceMatic Stage 3 — 0002_rls.sql
-- Row Level Security (PRD §7.3). RLS on every table.
-- Public reads the available menu; only admins read orders/metrics/forecasts;
-- writes to orders/line_items/forecasts come from the service-role key, which
-- BYPASSES RLS — so no permissive insert policy is needed (or wanted) on them.

-- is_admin(): true iff the current auth user is in the admin allowlist.
-- SECURITY DEFINER + pinned search_path so it can read admin_users under RLS.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from admin_users where user_id = auth.uid());
$$;

alter table menu_items       enable row level security;
alter table orders           enable row level security;
alter table order_line_items enable row level security;
alter table demand_forecasts enable row level security;
alter table admin_users      enable row level security;

-- Menu: anyone may read available items; only admins may modify.
create policy menu_public_read on menu_items
  for select using (is_available or is_admin());
create policy menu_admin_write on menu_items
  for all using (is_admin()) with check (is_admin());

-- Orders + line items: admins read; writes come from service-role (bypasses RLS).
create policy orders_admin_read on orders
  for select using (is_admin());
create policy oli_admin_read on order_line_items
  for select using (is_admin());

-- Forecasts: admins read.
create policy forecast_admin_read on demand_forecasts
  for select using (is_admin());

-- Admin allowlist: a user may read only their own row.
create policy admin_self_read on admin_users
  for select using (user_id = auth.uid());
