import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForecastChart } from "./ForecastChart";
import type { AdminForecast } from "@/lib/admin-api";

const forecast: AdminForecast = {
  generatedAt: "2026-07-04T12:00:00.000Z",
  model: "rf-v1",
  rmse: 1.234,
  points: [
    { date: "2026-07-05", hour: 13, predicted: 3 },
    { date: "2026-07-05", hour: 19, predicted: 6 },
    { date: "2026-07-05", hour: 20, predicted: 9 },
  ],
  top3PeakHours: [
    { hour: 20, avgPredicted: 9 },
    { hour: 19, avgPredicted: 6 },
    { hour: 13, avgPredicted: 3 },
  ],
};

describe("ForecastChart", () => {
  it("documents the model + RMSE in the caption", () => {
    render(<ForecastChart forecast={forecast} loading={false} />);
    expect(screen.getByText(/Model rf-v1/)).toBeInTheDocument();
    expect(screen.getByText(/RMSE 1\.23 orders\/hr/)).toBeInTheDocument();
  });

  it("shows the top-3 peak hours via formatHourIST", () => {
    render(<ForecastChart forecast={forecast} loading={false} />);
    expect(screen.getByText(/Peak #1/)).toBeInTheDocument();
    expect(screen.getByText(/Peak #3/)).toBeInTheDocument();
    // 8 PM (hour 20) is the peak — appears on the axis and the peak card.
    expect(screen.getAllByText("8 PM").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a placeholder when there is no forecast", () => {
    render(<ForecastChart forecast={null} loading={false} />);
    expect(screen.getByText(/No forecast yet/)).toBeInTheDocument();
  });

  it("renders a loading placeholder before data arrives", () => {
    render(<ForecastChart forecast={null} loading />);
    expect(screen.getByText(/Loading forecast/)).toBeInTheDocument();
  });
});
