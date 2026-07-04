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
    topping: { code: "T1", name: "Black Olives", pricePaise: 4900 },
  };
  return computeBill([s]);
};

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

function mockFetch(menuOk = true) {
  return vi.fn((url: string) => {
    if (String(url).includes("/api/menu")) {
      return Promise.resolve(
        menuOk
          ? jsonRes(200, { success: true, data: MENU })
          : jsonRes(500, { success: false, error: { code: "INTERNAL", message: "Failed to load menu" } }),
      );
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
  it("places an order through all 7 steps and confirms with the server bill", async () => {
    vi.stubGlobal("fetch", mockFetch(true));
    const user = userEvent.setup();
    render(<Stepper />);

    // 1) Intake
    await user.type(screen.getByLabelText("Name"), "Ravi Kumar");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // 2) Recommendation (placeholder, non-blocking)
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    // 3) Quantity
    await user.type(screen.getByLabelText("Number of pizzas"), "1");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // 4) Builder → 5) Bill
    await user.click(await screen.findByRole("button", { name: "Review bill" }));
    expect(await screen.findByText("₹586.46")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    // 6) Payment → place (default Cash)
    await user.click(await screen.findByRole("button", { name: "Place order" }));

    // 7) Confirmation echoes the saved order + Cash copy
    expect(await screen.findByText(/Thanks, Ravi Kumar/)).toBeInTheDocument();
    expect(screen.getByText("₹586.46")).toBeInTheDocument();
    expect(screen.getByText(/pay the rider/i)).toBeInTheDocument();

    // "New order" resets back to intake
    await user.click(screen.getByRole("button", { name: "New order" }));
    expect(await screen.findByText(/Who's ordering/)).toBeInTheDocument();
  });

  it("FR-9: a menu-load failure disables ordering with a retry, no crash", async () => {
    vi.stubGlobal("fetch", mockFetch(false));
    render(<Stepper />);
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText(/Failed to load menu/)).toBeInTheDocument();
  });
});
