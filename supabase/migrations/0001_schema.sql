-- PizzaFlow / SliceMatic Stage 3 — 0001_schema.sql
-- Data model (PRD §7.2). Money is stored as INTEGER PAISE, never floats.
-- One menu_items table with a category enum (swap-resilient); order_line_items
-- carries both FKs to menu_items AND snapshot name/price columns so historical
-- orders survive a menu swap.

create extension if not exists pgcrypto;              -- gen_random_uuid()

create type menu_category as enum ('base', 'pizza', 'topping');
create type payment_mode  as enum ('Cash', 'Card', 'UPI');

-- ── menu_items ─────────────────────────────────────────────────────────────
create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,                          -- original file ID: 'B1','P3','T7'
  name         text not null,
  category     menu_category not null,
  price_paise  integer not null check (price_paise > 0),
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (category, code)
);
create index idx_menu_category on menu_items (category) where is_available;

-- ── orders ─────────────────────────────────────────────────────────────────
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  customer_name      text not null check (char_length(customer_name) between 2 and 40),
  customer_phone     text not null check (customer_phone ~ '^[6-9][0-9]{9}$'),
  session_started_at timestamptz,
  placed_at          timestamptz not null default now(),
  quantity           integer not null check (quantity between 1 and 10),
  subtotal_paise     integer not null check (subtotal_paise >= 0),
  discount_paise     integer not null default 0 check (discount_paise >= 0),
  discount_applied   boolean not null default false,
  gst_paise          integer not null check (gst_paise >= 0),
  total_paise        integer not null check (total_paise >= 0),
  payment_mode       payment_mode not null,
  created_at         timestamptz not null default now()
);
create index idx_orders_placed_at    on orders (placed_at);
create index idx_orders_payment_mode on orders (payment_mode);

-- ── order_line_items (one row per pizza) ─────────────────────────────────────
create table order_line_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  line_no           integer not null check (line_no >= 1),
  base_item_id      uuid references menu_items(id) on delete set null,
  pizza_item_id     uuid references menu_items(id) on delete set null,
  topping_item_id   uuid references menu_items(id) on delete set null,
  base_name         text not null,                     -- snapshots
  pizza_name        text not null,
  topping_name      text not null,
  base_price_paise    integer not null,
  pizza_price_paise   integer not null,
  topping_price_paise integer not null,
  unit_price_paise  integer not null,
  unique (order_id, line_no)
);
create index idx_oli_order on order_line_items (order_id);
create index idx_oli_pizza on order_line_items (pizza_item_id);

-- ── demand_forecasts (Feature C output) ──────────────────────────────────────
create table demand_forecasts (
  id             uuid primary key default gen_random_uuid(),
  generated_at   timestamptz not null default now(),
  target_date    date not null,
  hour_of_day    smallint not null check (hour_of_day between 0 and 23),
  predicted_orders numeric(6,2) not null,
  model_version  text not null,
  rmse           numeric(8,3),
  unique (generated_at, target_date, hour_of_day)
);
create index idx_forecast_lookup on demand_forecasts (target_date, hour_of_day);

-- ── admin_users (admin allowlist) ────────────────────────────────────────────
create table admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
