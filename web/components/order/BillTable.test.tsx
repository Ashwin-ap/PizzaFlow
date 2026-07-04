import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillTable } from "./BillTable";
import { computeBill, type Selected } from "@/lib/pricing";

const sel = (b: number, p: number, t: number): Selected => ({
  base: { code: "b", name: "Base", pricePaise: b },
  pizza: { code: "p", name: "Pizza", pricePaise: p },
  topping: { code: "t", name: "Topping", pricePaise: t },
});
const times = (n: number, s: Selected) => Array.from({ length: n }, () => s);

// The client preview renders the SAME computeBill output the server returns, so
// these assertions double as a "client == server to the paise" check (PRD §23).
describe("BillTable — §23 worked traces", () => {
  it("§23.1: 5× (229+379+69) shows discount and ₹3594.87", () => {
    render(<BillTable bill={computeBill(times(5, sel(22900, 37900, 6900)))} />);
    expect(screen.getByText("₹3594.87")).toBeInTheDocument();
    expect(screen.getByText(/Discount/)).toBeInTheDocument();
  });

  it("§23.2: single (149+299+49) shows ₹586.46 and NO discount row", () => {
    render(<BillTable bill={computeBill([sel(14900, 29900, 4900)])} />);
    expect(screen.getByText("₹586.46")).toBeInTheDocument();
    expect(screen.queryByText(/Discount/)).not.toBeInTheDocument();
  });
});
