import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntakeForm } from "./IntakeForm";
import { NAME_ERR, PHONE_ERR } from "@/lib/validation";

const setup = () => {
  const onNext = vi.fn();
  render(<IntakeForm initial={{ name: "", phone: "" }} onNext={onNext} />);
  return { onNext, user: userEvent.setup() };
};

describe("IntakeForm (FR-1 / FR-2)", () => {
  it("rejects an all-spaces name (edge #1) and stays on step", async () => {
    const { onNext, user } = setup();
    await user.type(screen.getByLabelText("Name"), "   ");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(NAME_ERR)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("rejects a phone starting with 1 (edge #2)", async () => {
    const { onNext, user } = setup();
    await user.type(screen.getByLabelText("Name"), "Ravi Kumar");
    await user.type(screen.getByLabelText("Phone"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(PHONE_ERR)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("accepts valid input and passes trimmed values forward", async () => {
    const { onNext, user } = setup();
    await user.type(screen.getByLabelText("Name"), "  Ravi Kumar  ");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledWith({ name: "Ravi Kumar", phone: "9876543210" });
  });
});
