import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentStep, PAYMENT_CONFIRMATION } from "./PaymentStep";

describe("PaymentStep (FR-11)", () => {
  it("has mode-specific confirmation copy for all three modes", () => {
    expect(PAYMENT_CONFIRMATION.Cash).toMatch(/rider/i);
    expect(PAYMENT_CONFIRMATION.Card).toMatch(/confirmed/i);
    expect(PAYMENT_CONFIRMATION.UPI).toMatch(/collect request/i);
  });

  it("selecting a mode calls onChange; placing the order calls onPlaceOrder", async () => {
    const onChange = vi.fn();
    const onPlaceOrder = vi.fn();
    const user = userEvent.setup();
    render(
      <PaymentStep
        value="Cash"
        onChange={onChange}
        onBack={vi.fn()}
        onPlaceOrder={onPlaceOrder}
        submitting={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Card/ }));
    expect(onChange).toHaveBeenCalledWith("Card");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(onPlaceOrder).toHaveBeenCalled();
  });

  it("disables actions while submitting", () => {
    render(
      <PaymentStep
        value="UPI"
        onChange={vi.fn()}
        onBack={vi.fn()}
        onPlaceOrder={vi.fn()}
        submitting
      />,
    );
    expect(screen.getByRole("button", { name: "Placing order…" })).toBeDisabled();
  });
});
