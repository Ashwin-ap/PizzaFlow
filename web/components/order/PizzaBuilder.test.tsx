import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PizzaBuilder } from "./PizzaBuilder";
import { Cart } from "./Cart";
import { computeBill, type Selected } from "@/lib/pricing";
import type { Menu, OrderLineItem } from "@/lib/order-api";

const MENU: Menu = {
  bases: [
    { id: "b1", code: "B1", name: "Thin Crust", pricePaise: 10000 },
    { id: "b2", code: "B2", name: "Thick Crust", pricePaise: 12000 },
  ],
  pizzas: [
    { id: "p1", code: "P1", name: "Margherita", pricePaise: 20000 },
    { id: "p2", code: "P2", name: "Farmhouse", pricePaise: 24000 },
  ],
  toppings: [
    { id: "t1", code: "T1", name: "Cheese", pricePaise: 4000 },
    { id: "t2", code: "T2", name: "Olives", pricePaise: 5000 },
  ],
};

const LINE: OrderLineItem = { baseCode: "B1", pizzaCode: "P1", toppingCodes: ["T1"] };

const billFor = (n: number) =>
  computeBill(
    Array.from<unknown, Selected>({ length: n }, () => ({
      base: { code: "B1", name: "Thin Crust", pricePaise: 10000 },
      pizza: { code: "P1", name: "Margherita", pricePaise: 20000 },
      toppings: [{ code: "T1", name: "Cheese", pricePaise: 4000 }],
    })),
  );

describe("PizzaBuilder — tap to pick", () => {
  it("shows the full menu, selects an item, and adds to cart", async () => {
    const onChange = vi.fn();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <PizzaBuilder menu={MENU} value={LINE} onChange={onChange} onAdd={onAdd} cartCount={0} max={10} />,
    );

    // The whole menu is visible (no hidden dropdowns).
    expect(screen.getByText("Margherita")).toBeInTheDocument();
    expect(screen.getByText("Farmhouse")).toBeInTheDocument();
    expect(screen.getByText("Thick Crust")).toBeInTheDocument();

    // Tapping a different pizza reports the new selection.
    await user.click(screen.getByRole("button", { name: /Farmhouse/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pizzaCode: "P2" }));

    // Add to cart.
    await user.click(screen.getByRole("button", { name: /Add to cart/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("disables Add when the cart is full", () => {
    render(
      <PizzaBuilder menu={MENU} value={LINE} onChange={vi.fn()} onAdd={vi.fn()} cartCount={10} max={10} />,
    );
    expect(screen.getByRole("button", { name: /Cart full/ })).toBeDisabled();
  });
});

describe("Cart — discount nudge", () => {
  it("nudges toward the bulk discount, then shows it applied", () => {
    const cart4 = Array.from({ length: 4 }, () => LINE);
    const { rerender } = render(
      <Cart cart={cart4} menu={MENU} bill={billFor(4)} onRemove={vi.fn()} onReview={vi.fn()} />,
    );
    expect(screen.getByText(/Add 1 more pizza for 10% off/i)).toBeInTheDocument();

    const cart5 = Array.from({ length: 5 }, () => LINE);
    rerender(<Cart cart={cart5} menu={MENU} bill={billFor(5)} onRemove={vi.fn()} onReview={vi.fn()} />);
    expect(screen.getByText(/Bulk discount/i)).toBeInTheDocument();
  });
});
