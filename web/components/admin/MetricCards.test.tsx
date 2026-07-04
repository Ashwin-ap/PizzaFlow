import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCards } from "./MetricCards";

describe("MetricCards", () => {
  it("renders the four KPIs from metrics", () => {
    render(
      <MetricCards
        loading={false}
        metrics={{
          revenuePaise: 58646,
          orderCount: 3,
          topPizza: { name: "BBQ Chicken", count: 5 },
          busiestHour: { hour: 19, count: 4 },
        }}
      />,
    );
    expect(screen.getByText("₹586.46")).toBeInTheDocument();
    expect(screen.getByText("BBQ Chicken")).toBeInTheDocument();
    expect(screen.getByText("7 PM")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows placeholders when metrics are null", () => {
    render(<MetricCards loading metrics={null} />);
    expect(screen.getAllByText("—").length).toBe(4);
  });
});
