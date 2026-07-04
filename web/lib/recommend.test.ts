import { describe, it, expect } from "vitest";
import {
  validateModelPick,
  pickDeterministic,
  summarizeHistory,
  buildUserMessage,
  toResponse,
  type MenuLite,
} from "./recommend";

const MENU: MenuLite = {
  pizzas: [
    { code: "P1", name: "Margherita", pricePaise: 29900 },
    { code: "P7", name: "BBQ Chicken", pricePaise: 37900 },
  ],
  toppings: [
    { code: "T1", name: "Black Olives", pricePaise: 4900 },
    { code: "T2", name: "Extra Cheese", pricePaise: 6900 },
  ],
};

describe("validateModelPick — menu-validation guardrail", () => {
  it("accepts a pick whose codes are both in the menu", () => {
    const pick = validateModelPick({ pizza_code: "P7", topping_code: "T2", reason: "Yum" }, MENU);
    expect(pick).toEqual({ pizzaCode: "P7", toppingCode: "T2", reason: "Yum" });
  });

  it("rejects an invented/off-menu pizza or topping code", () => {
    expect(validateModelPick({ pizza_code: "P9", topping_code: "T2", reason: "x" }, MENU)).toBeNull();
    expect(validateModelPick({ pizza_code: "P1", topping_code: "T9", reason: "x" }, MENU)).toBeNull();
  });

  it("supplies a default reason when the model omits one, and rejects non-objects", () => {
    expect(validateModelPick({ pizza_code: "P1", topping_code: "T1" }, MENU)?.reason).toMatch(/pick/i);
    expect(validateModelPick("nope", MENU)).toBeNull();
    expect(validateModelPick(null, MENU)).toBeNull();
  });
});

describe("pickDeterministic — cold-start / fallback selector", () => {
  it("picks the most-ordered items when counts exist", () => {
    const pick = pickDeterministic(MENU, { pizza: { P1: 3, P7: 1 }, topping: { T1: 5 } });
    expect(pick.pizzaCode).toBe("P1");
    expect(pick.toppingCode).toBe("T1");
    expect(pick.reason).toMatch(/favourite/i);
  });

  it("falls back to the priciest of each when there is no order data", () => {
    const pick = pickDeterministic(MENU, { pizza: {}, topping: {} });
    expect(pick.pizzaCode).toBe("P7"); // 37900 > 29900
    expect(pick.toppingCode).toBe("T2"); // 6900 > 4900
    expect(pick.reason).toMatch(/premium/i);
  });
});

describe("summarizeHistory + buildUserMessage + toResponse", () => {
  it("flattens recent orders into (pizza, topping) pairs", () => {
    const rows = [
      { order_line_items: [{ pizza_name: "BBQ Chicken", topping_name: "Extra Cheese" }] },
      { order_line_items: [{ pizza_name: "Margherita", topping_name: "Black Olives" }] },
    ];
    expect(summarizeHistory(rows)).toEqual([
      { pizza: "BBQ Chicken", topping: "Extra Cheese" },
      { pizza: "Margherita", topping: "Black Olives" },
    ]);
  });

  it("embeds MENU and HISTORY in the user message", () => {
    const msg = buildUserMessage(MENU, [{ pizza: "BBQ Chicken", topping: "Extra Cheese" }]);
    expect(msg).toContain("MENU:");
    expect(msg).toContain("HISTORY:");
    expect(msg).toContain("P7");
  });

  it("attaches display names from the live menu", () => {
    expect(toResponse({ pizzaCode: "P7", toppingCode: "T2", reason: "r" }, MENU)).toEqual({
      pizzaCode: "P7",
      toppingCode: "T2",
      pizzaName: "BBQ Chicken",
      toppingName: "Extra Cheese",
      reason: "r",
    });
  });
});
