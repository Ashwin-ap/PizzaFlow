/**
 * Pricing engine (PRD §9) — the SINGLE source of truth for all money math.
 * Money is integer paise everywhere; we format to ₹ only at display (`rupees`).
 * The same constants price the server order (/api/orders) and the client preview,
 * so they always agree to the paise.
 *
 * DISCOUNT_THRESHOLD is the documented live-demo edit point (change 5 → 3).
 */
export const MIN_QTY = 1;
export const MAX_QTY = 10;
export const MIN_TOPPINGS = 1; // every pizza carries at least one topping
export const MAX_TOPPINGS = 5; // …and at most five
export const DISCOUNT_THRESHOLD = 5;
export const DISCOUNT_RATE = 0.1; // 10%
export const GST_RATE = 0.18; // 18%

export interface PricedItem {
  code: string;
  name: string;
  pricePaise: number;
}

/** One configured pizza: a base + a pizza + one-or-more toppings, each priced in paise. */
export interface Selected {
  base: PricedItem;
  pizza: PricedItem;
  toppings: PricedItem[];
}

export interface BillLineItem extends Selected {
  unitPricePaise: number;
}

export interface Bill {
  lineItems: BillLineItem[];
  quantity: number;
  subtotalPaise: number;
  discountApplied: boolean;
  discountPaise: number;
  postDiscountPaise: number;
  gstPaise: number;
  totalPaise: number;
}

const round = (n: number): number => Math.round(n); // half-up, integer paise

/**
 * Order of operations (fixed): unit = base + pizza + topping → subtotal = Σ units →
 * 10% discount iff qty ≥ threshold → GST 18% on the POST-DISCOUNT amount → total.
 * Rounds to integer paise at the discount and GST steps only.
 */
export function computeBill(pizzas: Selected[]): Bill {
  const lineItems: BillLineItem[] = pizzas.map((p) => ({
    ...p,
    unitPricePaise:
      p.base.pricePaise +
      p.pizza.pricePaise +
      p.toppings.reduce((s, t) => s + t.pricePaise, 0),
  }));
  const quantity = lineItems.length;
  const subtotalPaise = lineItems.reduce((s, li) => s + li.unitPricePaise, 0);
  const discountApplied = quantity >= DISCOUNT_THRESHOLD;
  const discountPaise = discountApplied ? round(subtotalPaise * DISCOUNT_RATE) : 0;
  const postDiscountPaise = subtotalPaise - discountPaise;
  const gstPaise = round(postDiscountPaise * GST_RATE);
  const totalPaise = postDiscountPaise + gstPaise;
  return {
    lineItems,
    quantity,
    subtotalPaise,
    discountApplied,
    discountPaise,
    postDiscountPaise,
    gstPaise,
    totalPaise,
  };
}

/** Format integer paise as `₹X.XX`. Display only — never feed back into math. */
export const rupees = (paise: number): string => `₹${(paise / 100).toFixed(2)}`;
