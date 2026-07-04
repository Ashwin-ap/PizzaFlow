import { describe, it, expect } from "vitest";
import {
  computeBill,
  rupees,
  DISCOUNT_THRESHOLD,
  type Selected,
} from "./pricing";

const item = (pricePaise: number): { code: string; name: string; pricePaise: number } => ({
  code: "x",
  name: "x",
  pricePaise,
});
// A single configured pizza with given base/pizza/topping paise prices.
const sel = (b: number, p: number, t: number): Selected => ({
  base: item(b),
  pizza: item(p),
  topping: item(t),
});
const times = (n: number, s: Selected): Selected[] => Array.from({ length: n }, () => s);

describe("computeBill — PRD §23 worked traces", () => {
  it("§23.1: 5× Cheese Burst(229) + BBQ Chicken(379) + Extra Cheese(69) → ₹3594.87", () => {
    const bill = computeBill(times(5, sel(22900, 37900, 6900)));
    expect(bill.quantity).toBe(5);
    expect(bill.lineItems[0].unitPricePaise).toBe(67700);
    expect(bill.subtotalPaise).toBe(338500);
    expect(bill.discountApplied).toBe(true);
    expect(bill.discountPaise).toBe(33850);
    expect(bill.postDiscountPaise).toBe(304650);
    expect(bill.gstPaise).toBe(54837);
    expect(bill.totalPaise).toBe(359487);
    expect(rupees(bill.totalPaise)).toBe("₹3594.87");
  });

  it("§23.2: single Thin(149) + Margherita(299) + Olives(49) → ₹586.46 (no discount)", () => {
    const bill = computeBill([sel(14900, 29900, 4900)]);
    expect(bill.quantity).toBe(1);
    expect(bill.subtotalPaise).toBe(49700);
    expect(bill.discountApplied).toBe(false);
    expect(bill.discountPaise).toBe(0);
    expect(bill.gstPaise).toBe(8946);
    expect(bill.totalPaise).toBe(58646);
    expect(rupees(bill.totalPaise)).toBe("₹586.46");
  });
});

describe("computeBill — discount boundary (threshold inclusive at 5)", () => {
  it("qty=4 → no discount", () => {
    const bill = computeBill(times(4, sel(22900, 37900, 6900)));
    expect(bill.discountApplied).toBe(false);
    expect(bill.discountPaise).toBe(0);
    expect(bill.subtotalPaise).toBe(270800);
    expect(bill.gstPaise).toBe(48744);
    expect(bill.totalPaise).toBe(319544);
  });

  it("qty=5 → discount applies (DISCOUNT_THRESHOLD is inclusive)", () => {
    expect(DISCOUNT_THRESHOLD).toBe(5);
    expect(computeBill(times(4, sel(100, 100, 100))).discountApplied).toBe(false);
    expect(computeBill(times(5, sel(100, 100, 100))).discountApplied).toBe(true);
  });
});

describe("rupees", () => {
  it("formats integer paise as ₹X.XX", () => {
    expect(rupees(58646)).toBe("₹586.46");
    expect(rupees(0)).toBe("₹0.00");
    expect(rupees(5)).toBe("₹0.05");
    expect(rupees(100)).toBe("₹1.00");
  });
});
