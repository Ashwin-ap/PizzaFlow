// Demo orders WITH line items — feeds Feature A (recommendation popularity + history).
//
// Unlike scripts/seed-orders.ts (timestamp-only synthetic history for the forecaster,
// phone prefix "9990", EXCLUDED from metrics), these are ~50 REAL-looking orders that
// carry full order_line_items, so they DO count in admin metrics AND in the
// recommendation's global popularity counts. They are biased toward a "hero" combo
// (BBQ Chicken + Extra Cheese) so that combo becomes the deterministic recommendation
// for any fresh phone.
//
// Idempotent: every run first deletes prior demo rows (phone LIKE '8100%') then reinserts
// (order_line_items cascade on the orders delete). Deterministic (seeded PRNG).
//
// Run: npm run seed:demo   (loads web/.env.local; needs SUPABASE_SECRET_KEY)
//   Requires the menu to be seeded first (npm run seed:menu).
import { serviceClient } from "./_env";
import { computeBill, type PricedItem, type Selected } from "../lib/pricing";

const IST_OFFSET_MIN = 5 * 60 + 30;
const DEMO_PHONE_PREFIX = "8100"; // real-looking, NOT the 9990 synthetic prefix → counts as real
const N_ORDERS = 50;
const SPAN_DAYS = 14;
const HERO_PIZZA = /bbq|chicken/i; // BBQ Chicken
const HERO_TOPPING = /extra cheese/i; // Extra Cheese
const HERO_BIAS = 0.7; // ~70% of picks are the hero item
const PAYMENT_MODES = ["Cash", "Card", "UPI"] as const;

const NAMES = [
  "Aarav Shah", "Isha Nair", "Rohan Mehta", "Priya Rao", "Kabir Singh", "Ananya Iyer",
  "Vihaan Gupta", "Diya Kapoor", "Arjun Reddy", "Meera Joshi", "Aditya Verma", "Sara Khan",
  "Karan Malhotra", "Neha Pillai", "Dev Sharma", "Riya Desai", "Ishaan Roy", "Tara Bose",
];

// Hourly weights over 11..22: lunch bump (12–14) + dinner peak (19–22).
const HOUR_WEIGHTS: [number, number][] = [
  [11, 1], [12, 4], [13, 4], [14, 3], [15, 1], [16, 1],
  [17, 2], [18, 3], [19, 5], [20, 6], [21, 5], [22, 3],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xbbca_fee5);
const randInt = (n: number) => Math.floor(rng() * n);
const pick = <T>(arr: T[]): T => arr[randInt(arr.length)];

function weightedHour(): number {
  const total = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [h, w] of HOUR_WEIGHTS) {
    r -= w;
    if (r <= 0) return h;
  }
  return 20;
}

interface MenuRow {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  category: "base" | "pizza" | "topping";
}

const toPriced = (r: MenuRow): PricedItem => ({ code: r.code, name: r.name, pricePaise: r.price_paise });

function placedAtIso(baseMs: number): string {
  const dayOffset = randInt(SPAN_DAYS);
  const d = new Date(baseMs - dayOffset * 86_400_000);
  const utcMs =
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), weightedHour(), randInt(60)) -
    IST_OFFSET_MIN * 60_000;
  return new Date(utcMs).toISOString();
}

async function main() {
  const sb = serviceClient();

  const { data: menuData, error: menuErr } = await sb
    .from("menu_items")
    .select("id, code, name, price_paise, category")
    .eq("is_available", true);
  if (menuErr) {
    console.error("menu fetch failed:", menuErr.message);
    process.exit(1);
  }
  const menu = (menuData ?? []) as MenuRow[];
  const bases = menu.filter((r) => r.category === "base");
  const pizzas = menu.filter((r) => r.category === "pizza");
  const toppings = menu.filter((r) => r.category === "topping");
  if (!bases.length || !pizzas.length || !toppings.length) {
    console.error("menu not seeded — run `npm run seed:menu` first.");
    process.exit(1);
  }
  const heroPizza = pizzas.find((p) => HERO_PIZZA.test(p.name)) ?? pizzas[0];
  const heroTopping = toppings.find((t) => HERO_TOPPING.test(t.name)) ?? toppings[0];
  console.log(`Hero combo → ${heroPizza.name} + ${heroTopping.name}`);

  // Idempotent reset (line items cascade on the orders delete).
  const { error: delErr } = await sb.from("orders").delete().like("customer_phone", `${DEMO_PHONE_PREFIX}%`);
  if (delErr) console.warn("cleanup warning:", delErr.message);

  const baseMs = Date.now();
  let pizzaCount = 0;
  let heroPizzaCount = 0;
  let heroToppingCount = 0;

  for (let i = 0; i < N_ORDERS; i++) {
    const qty = 1 + randInt(rng() < 0.75 ? 2 : 3); // mostly 1–2 pizzas, occasionally up to 3
    const dbLines: { base: MenuRow; pizza: MenuRow; toppings: MenuRow[] }[] = [];
    const selections: Selected[] = [];
    for (let k = 0; k < qty; k++) {
      const base = pick(bases);
      const pizza = rng() < HERO_BIAS ? heroPizza : pick(pizzas);
      const topping = rng() < HERO_BIAS ? heroTopping : pick(toppings);
      dbLines.push({ base, pizza, toppings: [topping] });
      selections.push({ base: toPriced(base), pizza: toPriced(pizza), toppings: [toPriced(topping)] });
      pizzaCount++;
      if (pizza.id === heroPizza.id) heroPizzaCount++;
      if (topping.id === heroTopping.id) heroToppingCount++;
    }

    const bill = computeBill(selections);
    const phone = DEMO_PHONE_PREFIX + String(randInt(1_000_000)).padStart(6, "0");
    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        customer_name: pick(NAMES),
        customer_phone: phone,
        placed_at: placedAtIso(baseMs),
        quantity: bill.quantity,
        subtotal_paise: bill.subtotalPaise,
        discount_paise: bill.discountPaise,
        discount_applied: bill.discountApplied,
        gst_paise: bill.gstPaise,
        total_paise: bill.totalPaise,
        payment_mode: pick(PAYMENT_MODES as unknown as string[]),
      })
      .select("id")
      .single();
    if (oErr || !order) {
      console.error(`order ${i} insert failed:`, oErr?.message);
      process.exit(1);
    }

    const liRows = bill.lineItems.map((li, idx) => ({
      order_id: order.id,
      line_no: idx + 1,
      base_item_id: dbLines[idx].base.id,
      pizza_item_id: dbLines[idx].pizza.id,
      topping_item_id: dbLines[idx].toppings[0].id,
      base_name: li.base.name,
      pizza_name: li.pizza.name,
      topping_name: li.toppings.map((t) => t.name).join(", "),
      base_price_paise: li.base.pricePaise,
      pizza_price_paise: li.pizza.pricePaise,
      topping_price_paise: li.toppings.reduce((s, t) => s + t.pricePaise, 0),
      unit_price_paise: li.unitPricePaise,
    }));
    const { error: liErr } = await sb.from("order_line_items").insert(liRows);
    if (liErr) {
      console.error(`line items for order ${i} failed:`, liErr.message);
      process.exit(1);
    }
  }

  console.log(
    `Seeded ${N_ORDERS} demo orders (${pizzaCount} pizzas). ` +
      `Hero pizza ${heroPizzaCount}/${pizzaCount}, hero topping ${heroToppingCount}/${pizzaCount}. ` +
      `Phone prefix ${DEMO_PHONE_PREFIX}.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
