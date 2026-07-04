// @vitest-environment node
//
// Live integration test for POST /api/recommend. Calls the route handler directly
// against the hosted Supabase project (and OpenRouter, if a key is present), so it is
// OPT-IN: runs only when Supabase creds are present (never in CI / plain `npm test`).
//
//   npm run test:recommend
//
// Each call uses a unique x-forwarded-for so it gets its own rate-limit bucket.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const hasCreds = Boolean(url && secretKey);

const NEW_PHONE = "9000000021"; // no history → cold start
const RETURNING_PHONE = "9000000022"; // seeded with one order below

describe.skipIf(!hasCreds)("recommend route (live DB)", () => {
  let POST: (req: Request) => Promise<Response>;
  let service: SupabaseClient;
  const createdOrderIds: string[] = [];
  let pizzaCodes: Set<string>;
  let toppingCodes: Set<string>;

  const post = (body: unknown, ip = `rec-${crypto.randomUUID()}`): Promise<Response> =>
    POST(
      new Request("http://localhost/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/recommend/route"));
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });

    const { data: menu } = await service
      .from("menu_items")
      .select("code, category")
      .eq("is_available", true);
    pizzaCodes = new Set((menu ?? []).filter((m) => m.category === "pizza").map((m) => m.code));
    toppingCodes = new Set((menu ?? []).filter((m) => m.category === "topping").map((m) => m.code));

    // Seed one order so RETURNING_PHONE has history.
    const { data: order } = await service
      .from("orders")
      .insert({
        customer_name: "Returning Buyer",
        customer_phone: RETURNING_PHONE,
        quantity: 1,
        subtotal_paise: 49700,
        discount_paise: 0,
        discount_applied: false,
        gst_paise: 8946,
        total_paise: 58646,
        payment_mode: "UPI",
      })
      .select("id")
      .single();
    if (order?.id) {
      createdOrderIds.push(order.id);
      await service.from("order_line_items").insert({
        order_id: order.id,
        line_no: 1,
        base_name: "Thin Crust",
        pizza_name: "Margherita",
        topping_name: "Black Olives",
        base_price_paise: 14900,
        pizza_price_paise: 29900,
        topping_price_paise: 4900,
        unit_price_paise: 49700,
      });
    }
  });

  afterAll(async () => {
    for (const id of createdOrderIds) await service.from("orders").delete().eq("id", id);
    await service.from("orders").delete().eq("customer_phone", RETURNING_PHONE);
  });

  it("bad phone → 400 VALIDATION_ERROR", async () => {
    const res = await post({ phone: "12345" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("cold-start phone → 200 with a valid on-menu recommendation", async () => {
    const res = await post({ phone: NEW_PHONE });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const rec = data.recommendation;
    expect(pizzaCodes.has(rec.pizzaCode)).toBe(true);
    expect(toppingCodes.has(rec.toppingCode)).toBe(true);
    expect(rec.reason.length).toBeGreaterThan(0);
    expect(rec.pizzaName).toBeTruthy();
  });

  it("returning phone → 200 with a menu-validated recommendation", async () => {
    const res = await post({ phone: RETURNING_PHONE });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // Whether the LLM answered or we fell back deterministically, the codes MUST be
    // on the live menu (the menu-validation guardrail).
    expect(pizzaCodes.has(data.recommendation.pizzaCode)).toBe(true);
    expect(toppingCodes.has(data.recommendation.toppingCode)).toBe(true);
  });
});
