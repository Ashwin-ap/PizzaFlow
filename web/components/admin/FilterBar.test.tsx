import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("emits a payment-filter change (preset preserved)", async () => {
    const onChange = vi.fn();
    render(<FilterBar filter={{}} presetKey="all" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "UPI" }));
    expect(onChange).toHaveBeenCalledWith({ filter: { payment: "UPI" }, presetKey: "all" });
  });

  it("emits a date preset with a computed `from` and clears it for All time", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar filter={{}} presetKey="all" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Last 7 days" }));
    const call = onChange.mock.calls[0][0];
    expect(call.presetKey).toBe("7d");
    expect(typeof call.filter.from).toBe("string");
  });
});
