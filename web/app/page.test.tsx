import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

beforeEach(() => {
  // StatusChips pings /api/health + /api/ready on mount.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true } as Response)),
  );
});

describe("landing page", () => {
  it("renders the branded hero without throwing", () => {
    render(<Home />);
    expect(screen.getByText(/Pizza ordering/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 3 · SliceMatic/i)).toBeInTheDocument();
  });
});
