import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "./Stepper";
import { computeBill, type Selected } from "@/lib/pricing";

// Single-item menu → defaults reproduce the §23.2 trace (₹586.46, no discount).
const MENU = {
  bases: [{ id: "b1", code: "B1", name: "Thin Crust", pricePaise: 14900 }],
  pizzas: [{ id: "p1", code: "P1", name: "Margherita", pricePaise: 29900 }],
  toppings: [{ id: "t1", code: "T1", name: "Black Olives", pricePaise: 4900 }],
};

const singleBill = () => {
  const s: Selected = {
    base: { code: "B1", name: "Thin Crust", pricePaise: 14900 },
    pizza: { code: "P1", name: "Margherita", pricePaise: 29900 },
    toppings: [{ code: "T1", name: "Black Olives", pricePaise: 4900 }],
  };
  return computeBill([s]);
};

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const RECOMMENDATION = {
  pizzaCode: "P1",
  toppingCode: "T1",
  pizzaName: "Margherita",
  toppingName: "Black Olives",
  reason: "A crowd favourite to get you started.",
};

function mockFetch(menuOk = true) {
  return vi.fn((url: string) => {
    if (String(url).includes("/api/menu")) {
      return Promise.resolve(
        menuOk
          ? jsonRes(200, { success: true, data: MENU })
          : jsonRes(500, { success: false, error: { code: "INTERNAL", message: "Failed to load menu" } }),
      );
    }
    if (String(url).includes("/api/recommend")) {
      return Promise.resolve(jsonRes(200, { success: true, data: { recommendation: RECOMMENDATION } }));
    }
    // POST /api/orders
    return Promise.resolve(
      jsonRes(201, { success: true, data: { order: { id: "o1" }, bill: singleBill() } }),
    );
  });
}

beforeEach(() => {
  if (!globalThis.crypto?.randomUUID) {
    // @ts-expect-error minimal shim for the test env
    globalThis.crypto = { randomUUID: () => "test-uuid" };
  }
});
afterEach(() => vi.unstubAllGlobals());

describe("Stepper — end to end", () => {
  it("places an order through the full flow and confirms with the server bill", async () => {
    vi.stubGlobal("fetch", mockFetch(true));
    const user = userEvent.setup();
    render(<Stepper />);

    // 1) Intake
    await user.type(screen.getByLabelText("Name"), "Ravi Kumar");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.click(screen.getByRole("button", { name: /start my order/i }));

    // 2) Recommendation — accept the pick (seeds the first pizza's pizza+topping)
    expect(await screen.findByText(/Margherita/, { selector: "p" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /use this/i }));

    // 3) Build — the recommended pizza is pre-selected; add it to the cart, then review
    await user.click(await screen.findByRole("button", { name: /Add to cart/ }));
    // The cart's "Review bill · ₹586.46" CTA (anchored ^ to skip the mobile cart-bar).
    await user.click(await screen.findByRole("button", { name: /^Review bill/ }));

    // 4) Bill → payment
    expect(await screen.findByText("₹586.46")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    // 5) Payment → place (default Cash)
    await user.click(await screen.findByRole("button", { name: "Place order" }));

    // 6) Confirmation echoes the saved order + Cash copy
    expect(await screen.findByText(/Thanks, Ravi Kumar/)).toBeInTheDocument();
    expect(screen.getByText("₹586.46")).toBeInTheDocument();
    expect(screen.getByText(/pay the rider/i)).toBeInTheDocument();

    // "Start a new order" resets back to intake
    await user.click(screen.getByRole("button", { name: "Start a new order" }));
    expect(await screen.findByText(/built your way/i)).toBeInTheDocument();
  });

  it("FR-9: a menu-load failure disables ordering with a retry, no crash", async () => {
    vi.stubGlobal("fetch", mockFetch(false));
    render(<Stepper />);
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText(/Failed to load menu/)).toBeInTheDocument();
  });
});
