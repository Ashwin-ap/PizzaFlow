import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

beforeEach(() => {
  // The Stepper fetches /api/menu on mount. Keep it pending so the flow stays on
  // the intake step (menuLoading) and the smoke assertion is deterministic.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
});

describe("home page (customer ordering flow)", () => {
  it("mounts the ordering stepper on the intake step", () => {
    render(<Home />);
    expect(screen.getByText(/Who's ordering/)).toBeInTheDocument();
    expect(screen.getByText(/1\. Details/)).toBeInTheDocument();
  });
});
