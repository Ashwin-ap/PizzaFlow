// Synthetic order history for the demand-forecasting model (Phase 7, Feature C).
//
// Generates ~75 days of fake historical orders matching the SliceMatic economics curve
// (PRD §7.4): ~38 orders/weekday, ~68/weekend, a lunch bump (12–14h) and a strong dinner
// peak (19–22h) across operating hours 11:00–23:00 IST. This gives the forecast model
// signal on day one (§13 cold-start).
//
// Every synthetic order carries the recognisable phone prefix "9990" (lib/synthetic.ts)
// so the admin metrics and Feature A popularity exclude it — the forecaster trains on all
// orders. We insert ONLY `orders` rows (no `order_line_items`): the forecaster needs just
// `placed_at`, and leaving out line items keeps the recommendation popularity counts
// (which read `order_line_items` directly) synthetic-free by construction. Money is still
// realistic — priced through the single `computeBill` engine.
//
// Deterministic (seeded PRNG) so the SHAPE is reproducible; the date anchor is "today" so
// the data stays recent. Idempotent: every run first deletes existing synthetic rows
// (phone LIKE '9990%') then reinserts, so re-running never duplicates.
//
// Run: npm run seed:orders   (loads web/.env.local; needs SUPABASE_SECRET_KEY)
//   Requires the menu to be seeded first (npm run seed:menu).
//   Override the span with SEED_DAYS=90.
import { serviceClient } from "./_env";
import { computeBill, type PricedItem } from "../lib/pricing";
import { SYNTHETIC_PHONE_PREFIX, SYNTHETIC_PHONE_LIKE } from "../lib/synthetic";

const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30, no DST
const OPERATING_HOURS = Array.from({ length: 12 }, (_, i) => 11 + i); // 11..22 (23:00 close)
const PAYMENT_MODES = ["Cash", "Card", "UPI"] as const;

// Hourly demand weights over 11..22: quiet open, lunch bump 12–14, strong dinner peak 19–22.
const HOUR_WEIGHTS: Record<number, number> = {
  11: 1.5, 12: 4, 13: 4.5, 14: 3, 15: 1.5, 16: 1.5,
  17: 2, 18: 3, 19: 5, 20: 6, 21: 5.5, 22: 3,
};
const WEIGHT_SUM = OPERATING_HOURS.reduce((s, h) => s + HOUR_WEIGHTS[h], 0);

const WEEKDAY_ORDERS = 38;
const WEEKEND_ORDERS = 68;

const NAMES = [
  "Aarav", "Isha", "Rohan", "Priya", "Kabir", "Ananya", "Vihaan", "Diya",
  "Arjun", "Meera", "Aditya", "Sara", "Karan", "Neha", "Dev", "Riya",
  "Ishaan", "Tara", "Nikhil", "Pooja", "Rahul", "Sneha", "Manish", "Kavya",
];

// ── seeded PRNG ──────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x51ce_a11c);
const randInt = (n: number) => Math.floor(rng() * n);
const pick = <T>(arr: T[]): T => arr[randInt(arr.length)];

/** Knuth's Poisson sampler (small λ) using the seeded uniform stream. */
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Order quantity: mostly small baskets, occasionally hitting the 5-pizza discount. */
function sampleQuantity(): number {
  const r = rng();
  if (r < 0.4) return 1;
  if (r < 0.7) return 2;
  if (r < 0.85) return 3;
  if (r < 0.95) return 4;
  return 5;
}

interface MenuRow {
  code: string;
  name: string;
  price_paise: number;
  category: "base" | "pizza" | "topping";
}

interface OrderRow {
  customer_name: string;
  customer_phone: string;
  placed_at: string;
  quantity: number;
  subtotal_paise: number;
  discount_paise: number;
  discount_applied: boolean;
  gst_paise: number;
  total_paise: number;
  payment_mode: string;
}

/** IST calendar date {y,m,d} for `daysAgo` days before today (IST). */
function istDateDaysAgo(daysAgo: number): { y: number; m: number; d: number } {
  const nowIst = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  const day = new Date(
    Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) -
      daysAgo * 86_400_000,
  );
  return { y: day.getUTCFullYear(), m: day.getUTCMonth(), d: day.getUTCDate() };
}

/** UTC ISO instant for an IST wall-clock date+time (subtract the +05:30 offset). */
function istWallClockToUtcIso(
  y: number,
  m: number,
  d: number,
  hour: number,
  min: number,
  sec: number,
): string {
  const asIfUtc = Date.UTC(y, m, d, hour, min, sec);
  return new Date(asIfUtc - IST_OFFSET_MIN * 60_000).toISOString();
}

/** Day-of-week (0=Sun..6=Sat) for an IST calendar date. */
function dowIST(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m, d)).getUTCDay();
}

async function main(): Promise<void> {
  const days = Number(process.env.SEED_DAYS ?? 75);
  if (!Number.isFinite(days) || days < 7 || days > 180) {
    console.error(`SEED_DAYS must be between 7 and 180 (got ${process.env.SEED_DAYS}).`);
    process.exit(1);
  }

  const supabase = serviceClient();

  // Live menu → priced options for each category.
  const { data: menuData, error: menuErr } = await supabase
    .from("menu_items")
    .select("code, name, price_paise, category")
    .eq("is_available", true);
  if (menuErr) {
    console.error(`Menu load failed: ${menuErr.message}`);
    process.exit(1);
  }
  const menu = (menuData ?? []) as MenuRow[];
  const toItem = (r: MenuRow): PricedItem => ({ code: r.code, name: r.name, pricePaise: r.price_paise });
  const bases = menu.filter((r) => r.category === "base").map(toItem);
  const pizzas = menu.filter((r) => r.category === "pizza").map(toItem);
  const toppings = menu.filter((r) => r.category === "topping").map(toItem);
  if (!bases.length || !pizzas.length || !toppings.length) {
    console.error("Menu is missing a category — run `npm run seed:menu` first.");
    process.exit(1);
  }

  // Clear prior synthetic rows so re-runs are idempotent (never touches real orders).
  const { error: delErr } = await supabase
    .from("orders")
    .delete()
    .like("customer_phone", SYNTHETIC_PHONE_LIKE);
  if (delErr) {
    console.error(`Failed clearing prior synthetic orders: ${delErr.message}`);
    process.exit(1);
  }

  // Generate.
  const rows: OrderRow[] = [];
  for (let ago = days; ago >= 1; ago--) {
    const { y, m, d } = istDateDaysAgo(ago);
    const weekend = [0, 6].includes(dowIST(y, m, d));
    const dailyTarget = (weekend ? WEEKEND_ORDERS : WEEKDAY_ORDERS) * (0.9 + rng() * 0.2);

    for (const hour of OPERATING_HOURS) {
      const lambda = (dailyTarget * HOUR_WEIGHTS[hour]) / WEIGHT_SUM;
      const count = poisson(lambda);
      for (let i = 0; i < count; i++) {
        const quantity = sampleQuantity();
        const selections = Array.from({ length: quantity }, () => ({
          base: pick(bases),
          pizza: pick(pizzas),
          topping: pick(toppings),
        }));
        const bill = computeBill(selections);
        rows.push({
          customer_name: pick(NAMES),
          customer_phone: SYNTHETIC_PHONE_PREFIX + String(randInt(1_000_000)).padStart(6, "0"),
          placed_at: istWallClockToUtcIso(y, m, d, hour, randInt(60), randInt(60)),
          quantity,
          subtotal_paise: bill.subtotalPaise,
          discount_paise: bill.discountPaise,
          discount_applied: bill.discountApplied,
          gst_paise: bill.gstPaise,
          total_paise: bill.totalPaise,
          payment_mode: pick(PAYMENT_MODES as unknown as string[]),
        });
      }
    }
  }

  // Insert in batches.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("orders").insert(chunk);
    if (error) {
      console.error(`Insert failed at row ${i}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log(
    `Seed complete: ${rows.length} synthetic orders over ${days} days (phone prefix ${SYNTHETIC_PHONE_PREFIX}).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
