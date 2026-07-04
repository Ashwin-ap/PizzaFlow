import { describe, it, expect } from "vitest";
import {
  nameSchema,
  phoneSchema,
  qtySchema,
  paymentSchema,
  choiceSchema,
  orderBodySchema,
  fieldErrors,
  NAME_ERR,
  PHONE_ERR,
  QTY_ERR,
  QTY_MAX_ERR,
  PAYMENT_ERR,
} from "./validation";

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0].message;

describe("nameSchema (FR-1)", () => {
  it("accepts valid names, trimming", () => {
    expect(nameSchema.parse("  Ravi Kumar  ")).toBe("Ravi Kumar");
    expect(nameSchema.safeParse("Jean Pierre").success).toBe(true);
  });
  it("rejects with the exact message", () => {
    // edge case #1 — only spaces
    expect(msg(nameSchema.safeParse("   "))).toBe(NAME_ERR);
    expect(msg(nameSchema.safeParse("A"))).toBe(NAME_ERR); // too short
    expect(msg(nameSchema.safeParse("Ravi123"))).toBe(NAME_ERR); // digits
    expect(msg(nameSchema.safeParse("Bob!"))).toBe(NAME_ERR); // symbol
    expect(msg(nameSchema.safeParse("a".repeat(41)))).toBe(NAME_ERR); // too long
  });
});

describe("phoneSchema (FR-2)", () => {
  it("accepts 10 digits starting 6-9", () => {
    expect(phoneSchema.safeParse("9876543210").success).toBe(true);
  });
  it("rejects with the exact message", () => {
    expect(msg(phoneSchema.safeParse("1234567890"))).toBe(PHONE_ERR); // edge #2: starts with 1
    expect(msg(phoneSchema.safeParse("98765"))).toBe(PHONE_ERR); // too short
    expect(msg(phoneSchema.safeParse("98765abcde"))).toBe(PHONE_ERR); // non-digits
    expect(msg(phoneSchema.safeParse("59876543210"))).toBe(PHONE_ERR); // 11 digits / leading 5
  });
});

describe("qtySchema (FR-5)", () => {
  it("accepts whole numbers 1–10", () => {
    for (const q of [1, 5, 10, "1", "10"]) {
      expect(qtySchema.safeParse(q).success).toBe(true);
    }
  });
  it("uses the range vs cap messages correctly", () => {
    expect(msg(qtySchema.safeParse(0))).toBe(QTY_ERR); // edge #3
    expect(msg(qtySchema.safeParse(11))).toBe(QTY_MAX_ERR); // edge #3 cap
    expect(msg(qtySchema.safeParse("2.5"))).toBe(QTY_ERR); // edge #7 non-integer
    expect(msg(qtySchema.safeParse("three"))).toBe(QTY_ERR); // edge #7 word
    expect(msg(qtySchema.safeParse(""))).toBe(QTY_ERR); // edge #6 empty
  });
});

describe("paymentSchema (FR-11)", () => {
  it("accepts the three modes", () => {
    for (const p of ["Cash", "Card", "UPI"]) {
      expect(paymentSchema.safeParse(p).success).toBe(true);
    }
  });
  it("rejects anything else with the exact message", () => {
    expect(msg(paymentSchema.safeParse("Bitcoin"))).toBe(PAYMENT_ERR);
  });
});

describe("choiceSchema (FR-8)", () => {
  const c = choiceSchema(5);
  it("accepts an in-range index", () => {
    expect(c.safeParse("3").success).toBe(true);
  });
  it("rejects out-of-range / non-numeric (edge #4, #5)", () => {
    expect(msg(c.safeParse("0"))).toBe("Enter the item NUMBER from the list (1–5).");
    expect(msg(c.safeParse("6"))).toBe("Enter the item NUMBER from the list (1–5).");
    expect(msg(c.safeParse("299"))).toBe("Enter the item NUMBER from the list (1–5)."); // edge #5: price as index
    expect(msg(c.safeParse("x"))).toBe("Enter the item NUMBER from the list (1–5).");
  });
});

describe("orderBodySchema", () => {
  const valid = {
    name: "Ravi Kumar",
    phone: "9876543210",
    paymentMode: "UPI",
    lineItems: [{ baseCode: "B1", pizzaCode: "P1", toppingCode: "T1" }],
  };
  it("accepts a valid body", () => {
    expect(orderBodySchema.safeParse(valid).success).toBe(true);
  });
  it("strips any injected price fields (server-authoritative pricing)", () => {
    const tampered = {
      ...valid,
      lineItems: [{ baseCode: "B1", pizzaCode: "P1", toppingCode: "T1", pricePaise: 1 }],
    };
    const parsed = orderBodySchema.parse(tampered);
    expect(parsed.lineItems[0]).not.toHaveProperty("pricePaise");
  });
  it("reports field errors for bad phone", () => {
    const r = orderBodySchema.safeParse({ ...valid, phone: "12345" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).phone).toEqual([PHONE_ERR]);
  });
  it("rejects >10 line items with the cap message", () => {
    const many = { ...valid, lineItems: Array(11).fill(valid.lineItems[0]) };
    expect(msg(orderBodySchema.safeParse(many))).toBe(QTY_MAX_ERR);
  });
});
