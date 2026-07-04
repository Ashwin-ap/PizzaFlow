import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityStep } from "./QuantityStep";
import { QTY_ERR, QTY_MAX_ERR } from "@/lib/validation";

const setup = () => {
  const onNext = vi.fn();
  const onBack = vi.fn();
  render(<QuantityStep initial={null} onBack={onBack} onNext={onNext} />);
  return { onNext, onBack, user: userEvent.setup() };
};

describe("QuantityStep (FR-5)", () => {
  const field = () => screen.getByLabelText("Number of pizzas");
  const submit = () => screen.getByRole("button", { name: "Continue" });

  it.each([
    ["0", QTY_ERR], // edge #3 range
    ["11", QTY_MAX_ERR], // edge #3 cap
    ["2.5", QTY_ERR], // edge #7 non-integer
    ["three", QTY_ERR], // edge #7 word
  ])("rejects %s with the exact message", async (input, message) => {
    const { onNext, user } = setup();
    await user.type(field(), input);
    await user.click(submit());
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("rejects empty (edge #6) and stays on step", async () => {
    const { onNext, user } = setup();
    await user.click(submit());
    expect(screen.getByText(QTY_ERR)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("accepts a whole number 1–10", async () => {
    const { onNext, user } = setup();
    await user.type(field(), "3");
    await user.click(submit());
    expect(onNext).toHaveBeenCalledWith(3);
  });
});
