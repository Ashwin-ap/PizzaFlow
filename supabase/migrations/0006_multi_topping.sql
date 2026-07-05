-- PizzaFlow / SliceMatic Stage 3 — 0006_multi_topping.sql
-- A pizza can now carry 1–5 toppings (was exactly one). This is ADDITIVE and
-- backward-compatible: the existing scalar topping_* columns are kept and now hold
-- a SUMMARY (name = comma-joined, price = sum, id = first topping), so admin
-- exports, the forecast reader and any pre-migration order rows keep working. The
-- full per-topping snapshot lives in the new `toppings` JSONB array.
--
-- Money is still NOT computed here — lib/pricing.ts remains the single source of
-- truth; unit_price_paise already includes every topping.

alter table order_line_items
  add column if not exists toppings jsonb not null default '[]'::jsonb;

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
      base_price_paise, pizza_price_paise, topping_price_paise, unit_price_paise,
      toppings
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
      (li->>'unitPricePaise')::int,
      coalesce(li->'toppings', '[]'::jsonb)
    );
  end loop;

  return to_jsonb(new_order);
end;
$$;

-- Re-assert the least-privilege grants (create-or-replace keeps the ACL, but we
-- restate it to match 0003/0005 and stay explicit).
revoke execute on function create_order(jsonb) from public, anon, authenticated;
grant  execute on function create_order(jsonb) to service_role;
