/**
 * Recommendation DOMAIN (PRD §12 / §23.3) — pure, no I/O, unit-tested. The route
 * (app/api/recommend/route.ts) wires this to Supabase + OpenRouter.
 *
 * Guardrails live here: the model may ONLY pick codes present in the live menu
 * (validateModelPick), and every failure/cold-start path resolves to a deterministic
 * pick (pickDeterministic) so ordering is never blocked.
 */
import type { Recommendation } from "@/lib/order-api";

export type { Recommendation };

export interface MenuLiteItem {
  code: string;
  name: string;
  pricePaise: number;
}

export interface MenuLite {
  pizzas: MenuLiteItem[];
  toppings: MenuLiteItem[];
}

export interface Pick {
  pizzaCode: string;
  toppingCode: string;
  reason: string;
}

/** Per-code order counts (global popularity), keyed by menu code. */
export interface Counts {
  pizza: Record<string, number>;
  topping: Record<string, number>;
}

/** Verbatim system prompt (PRD §23.3). Documented in the README at Phase 8. */
export const SYSTEM_PROMPT = `You are SliceMatic's pizza recommendation assistant.

You are given:
1. MENU — the CURRENTLY AVAILABLE items as JSON, grouped into pizzas and toppings,
   each with a "code" and "name".
2. HISTORY — the customer's past orders as JSON (may be empty).

Task: recommend EXACTLY ONE pizza and ONE topping, chosen ONLY from the provided
MENU, that best fit the customer's demonstrated preferences. If HISTORY is empty,
recommend a widely popular combination and frame it as a popular pick.

Rules:
- Never suggest an item whose code is not present in MENU.
- "reason" must be ONE friendly sentence, under 20 words, no emojis.
- Respond with ONLY a JSON object matching the schema. No text before or after.

Output schema:
{ "pizza_code": string, "topping_code": string, "reason": string }`;

/** A single past pick (pizza + topping names) for the compact HISTORY payload. */
export interface HistoryPick {
  pizza: string;
  topping: string;
}

interface HistoryRow {
  order_line_items?: { pizza_name?: string | null; topping_name?: string | null }[] | null;
}

/** Flatten recent orders into a compact list of (pizza, topping) name pairs (cap 15). */
export function summarizeHistory(rows: HistoryRow[]): HistoryPick[] {
  const out: HistoryPick[] = [];
  for (const r of rows) {
    for (const li of r.order_line_items ?? []) {
      if (li.pizza_name && li.topping_name) out.push({ pizza: li.pizza_name, topping: li.topping_name });
      if (out.length >= 15) return out;
    }
  }
  return out;
}

/** Build the user message: current MENU (codes+names) + the customer's HISTORY. */
export function buildUserMessage(menu: MenuLite, history: HistoryPick[]): string {
  const menuPayload = {
    pizzas: menu.pizzas.map((p) => ({ code: p.code, name: p.name })),
    toppings: menu.toppings.map((t) => ({ code: t.code, name: t.name })),
  };
  return `MENU:\n${JSON.stringify(menuPayload)}\n\nHISTORY:\n${JSON.stringify(history)}`;
}

/**
 * Validate the model's raw JSON output against the live menu. Returns a Pick only if
 * BOTH codes exist in the menu (the model "must not invent items"); else null so the
 * caller falls back deterministically.
 */
export function validateModelPick(raw: unknown, menu: MenuLite): Pick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pizzaCode = typeof o.pizza_code === "string" ? o.pizza_code : "";
  const toppingCode = typeof o.topping_code === "string" ? o.topping_code : "";
  if (!menu.pizzas.some((p) => p.code === pizzaCode)) return null;
  if (!menu.toppings.some((t) => t.code === toppingCode)) return null;
  const reason =
    typeof o.reason === "string" && o.reason.trim()
      ? o.reason.trim()
      : "A tasty pick chosen just for you.";
  return { pizzaCode, toppingCode, reason };
}

/** Most-ordered available item; if no order data, the priciest (an upsell default). */
function topByCount(items: MenuLiteItem[], counts: Record<string, number>): { code: string; used: boolean } {
  let best: MenuLiteItem | null = null;
  let bestCount = 0;
  for (const it of items) {
    const c = counts[it.code] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = it;
    }
  }
  if (best) return { code: best.code, used: true };
  const priciest = items.reduce((a, b) => (b.pricePaise > a.pricePaise ? b : a));
  return { code: priciest.code, used: false };
}

/**
 * Deterministic pick (PRD §12.1 fallback + cold start): most-ordered pizza & topping
 * from order_line_items counts; when there's no order data, the priciest of each
 * (the locked house-favourite default). Assumes non-empty categories.
 */
export function pickDeterministic(menu: MenuLite, counts: Counts): Pick {
  const p = topByCount(menu.pizzas, counts.pizza);
  const t = topByCount(menu.toppings, counts.topping);
  const reason =
    p.used || t.used
      ? "A crowd favourite to get you started."
      : "Our most-loved premium combination.";
  return { pizzaCode: p.code, toppingCode: t.code, reason };
}

/** Attach display names from the live menu → the API/UI Recommendation shape. */
export function toResponse(pick: Pick, menu: MenuLite): Recommendation {
  const pizza = menu.pizzas.find((p) => p.code === pick.pizzaCode);
  const topping = menu.toppings.find((t) => t.code === pick.toppingCode);
  return {
    pizzaCode: pick.pizzaCode,
    toppingCode: pick.toppingCode,
    pizzaName: pizza?.name ?? pick.pizzaCode,
    toppingName: topping?.name ?? pick.toppingCode,
    reason: pick.reason,
  };
}
