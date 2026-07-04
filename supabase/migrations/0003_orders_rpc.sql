-- PizzaFlow / SliceMatic Stage 3 — 0003_orders_rpc.sql
-- Atomic order creation + idempotency (PRD §10.3 "commit atomically or not at all",
-- §11.2/§11.4 "409 CONFLICT on replay"). PostgREST can't do a multi-table transaction
-- in one REST call, so order + all line items are written by a single SECURITY DEFINER
-- function. Idempotency is a unique key on orders: a replayed Idempotency-Key raises
-- 23505 and rolls the whole call back.
--
-- Money is NOT computed here — lib/pricing.ts is the single source of truth. This
-- function is a dumb transactional writer that trusts the server-computed values.

alter table orders add column idempotency_key text;
create unique index idx_orders_idempotency
  on orders (idempotency_key) where idempotency_key is not null;

create or replace function create_order(payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_order orders;
  li jsonb;
begin
  insert into orders (
    customer_name, customer_phone, session_started_at, quantity,
    subtotal_paise, discount_paise, discount_applied, gst_paise, total_paise,
    payment_mode, idempotency_key
  ) values (
    payload->>'customerName',
    payload->>'customerPhone',
    nullif(payload->>'sessionStartedAt', '')::timestamptz,
    (payload->>'quantity')::int,
    (payload->>'subtotalPaise')::int,
    (payload->>'discountPaise')::int,
    (payload->>'discountApplied')::boolean,
    (payload->>'gstPaise')::int,
    (payload->>'totalPaise')::int,
    (payload->>'paymentMode')::payment_mode,
    nullif(payload->>'idempotencyKey', '')
  )
  returning * into new_order;

  for li in select * from jsonb_array_elements(payload->'lineItems')
  loop
    insert into order_line_items (
      order_id, line_no,
      base_item_id, pizza_item_id, topping_item_id,
      base_name, pizza_name, topping_name,
      base_price_paise, pizza_price_paise, topping_price_paise, unit_price_paise
    ) values (
      new_order.id,
      (li->>'lineNo')::int,
      (li->>'baseItemId')::uuid,
      (li->>'pizzaItemId')::uuid,
      (li->>'toppingItemId')::uuid,
      li->>'baseName',
      li->>'pizzaName',
      li->>'toppingName',
      (li->>'basePricePaise')::int,
      (li->>'pizzaPricePaise')::int,
      (li->>'toppingPricePaise')::int,
      (li->>'unitPricePaise')::int
    );
  end loop;

  return to_jsonb(new_order);
end;
$$;

-- PostgREST exposes public functions as anon-callable RPC. Without this revoke, anyone
-- with the publishable key could insert arbitrary orders and bypass server-side pricing.
-- Supabase's default privileges grant EXECUTE to anon/authenticated explicitly, so we
-- must revoke from them by name (revoking from PUBLIC alone does NOT remove those grants).
revoke execute on function create_order(jsonb) from public, anon, authenticated;
grant  execute on function create_order(jsonb) to service_role;
