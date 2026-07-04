// @vitest-environment node
//
// Live integration test for GET /api/menu and POST /api/orders. Calls the route
// handlers directly (no dev server) against the hosted Supabase project, so it is
// OPT-IN: runs only when Supabase creds are present (never in CI / plain `npm test`).
//
//   npm run test:integration
//
// Each order test uses a unique x-forwarded-for so it gets its own rate-limit bucket;
// the flood test deliberately reuses one bucket to trip 429.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const hasCreds = Boolean(
  url && secretKey && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const TEST_PHONE = "9000000009"; // cleanup handle

describe.skipIf(!hasCreds)("orders + menu routes (live DB)", () => {
  let GET: () => Promise<Response>;
  let POST: (req: Request) => Promise<Response>;
  let service: SupabaseClient;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/menu/route"));
    ({ POST } = await import("@/app/api/orders/route"));
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    for (const id of createdIds) await service.from("orders").delete().eq("id", id);
    await service.from("orders").delete().eq("customer_phone", TEST_PHONE);
  });

  const postOrder = (
    body: unknown,
    opts: { key?: string; ip?: string } = {},
  ): Promise<Response> =>
    POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": opts.ip ?? `test-${crypto.randomUUID()}`,
          ...(opts.key ? { "idempotency-key": opts.key } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  const line = { baseCode: "B1", pizzaCode: "P1", toppingCode: "T1" };

  it("GET /api/menu returns grouped menu with pricePaise", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.bases.length).toBeGreaterThan(0);
    expect(json.data.pizzas.length).toBeGreaterThan(0);
    expect(json.data.toppings.length).toBeGreaterThan(0);
    expect(json.data.bases[0]).toHaveProperty("pricePaise");
    expect(json.data.bases[0]).not.toHaveProperty("price_paise");
  });

  it("prices server-side and persists { order, bill }", async () => {
    // B3 Cheese Burst 229 + P7 BBQ 379 + T2 Extra Cheese 69 = ₹677 (single, no discount)
    const res = await postOrder(
      { name: "Test Buyer", phone: TEST_PHONE, paymentMode: "UPI",
        lineItems: [{ baseCode: "B3", pizzaCode: "P7", toppingCode: "T2" }] },
      { key: crypto.randomUUID() },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.bill.subtotalPaise).toBe(67700);
    expect(json.data.bill.discountApplied).toBe(false);
    expect(json.data.bill.gstPaise).toBe(12186);
    expect(json.data.bill.totalPaise).toBe(79886);
    expect(json.data.order.total_paise).toBe(79886);
    expect(json.data.order.id).toBeTruthy();
    createdIds.push(json.data.order.id);
  });

  it("ignores client-sent prices (server-authoritative)", async () => {
    const res = await postOrder(
      { name: "Test Buyer", phone: TEST_PHONE, paymentMode: "Cash",
        subtotalPaise: 1, totalPaise: 1,
        lineItems: [{ ...line, pricePaise: 1, basePricePaise: 1 }] },
      { key: crypto.randomUUID() },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    // B1 149 + P1 299 + T1 49 = ₹497 → 49700, not the injected 1
    expect(json.data.bill.subtotalPaise).toBe(49700);
    createdIds.push(json.data.order.id);
  });

  it("replayed Idempotency-Key → 409 CONFLICT", async () => {
    const key = crypto.randomUUID();
    const body = { name: "Test Buyer", phone: TEST_PHONE, paymentMode: "Cash", lineItems: [line] };
    const r1 = await postOrder(body, { key });
    expect(r1.status).toBe(201);
    createdIds.push((await r1.json()).data.order.id);
    const r2 = await postOrder(body, { key });
    expect(r2.status).toBe(409);
    expect((await r2.json()).error.code).toBe("CONFLICT");
  });

  it("unknown code → 422 MENU_ITEM_NOT_FOUND", async () => {
    const res = await postOrder(
      { name: "Test Buyer", phone: TEST_PHONE, paymentMode: "Cash",
        lineItems: [{ baseCode: "ZZ9", pizzaCode: "P1", toppingCode: "T1" }] },
      { key: crypto.randomUUID() },
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("MENU_ITEM_NOT_FOUND");
  });

  it("bad phone → 400 VALIDATION_ERROR with fields", async () => {
    const res = await postOrder({
      name: "Test Buyer", phone: "12345", paymentMode: "Cash", lineItems: [line],
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.fields.phone).toBeTruthy();
  });

  it("oversized body → 400 VALIDATION_ERROR", async () => {
    const res = await postOrder({
      name: "Test Buyer", phone: TEST_PHONE, paymentMode: "Cash",
      lineItems: [line], pad: "x".repeat(11 * 1024),
    });
    expect(res.status).toBe(400);
  });

  it("atomic: a failing line item rolls back the whole order (no orphan)", async () => {
    // Call the RPC directly with two line items sharing line_no=1 → the 2nd insert
    // violates unique(order_id, line_no); the whole transaction must roll back.
    const key = crypto.randomUUID();
    const li = {
      lineNo: 1, baseItemId: null, pizzaItemId: null, toppingItemId: null,
      baseName: "a", pizzaName: "b", toppingName: "c",
      basePricePaise: 1, pizzaPricePaise: 1, toppingPricePaise: 1, unitPricePaise: 3,
    };
    const payload = {
      customerName: "Rollback Test", customerPhone: TEST_PHONE, sessionStartedAt: null,
      quantity: 2, subtotalPaise: 6, discountPaise: 0, discountApplied: false,
      gstPaise: 1, totalPaise: 7, paymentMode: "Cash", idempotencyKey: key,
      lineItems: [li, { ...li }],
    };
    const { error } = await service.rpc("create_order", { payload });
    expect(error).not.toBeNull();
    const { data } = await service.from("orders").select("id").eq("idempotency_key", key);
    expect(data ?? []).toHaveLength(0);
  });

  it("flood → 429 RATE_LIMITED (>10 / 60s from one IP)", async () => {
    const ip = `flood-${crypto.randomUUID()}`;
    // Invalid body (bad phone) so no orders are inserted — rate limit is checked
    // BEFORE validation, so the counter still increments.
    const bad = { name: "Test Buyer", phone: "12345", paymentMode: "Cash", lineItems: [line] };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await postOrder(bad, { ip })).status);
    // First 10 pass the limiter (then 400 on validation); 11th+ are rate-limited.
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(statuses[11]).toBe(429);
  });
});
