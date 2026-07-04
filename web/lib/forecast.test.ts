import { describe, it, expect } from "vitest";
import { averageByHour, computeTop3PeakHours, type ForecastPoint } from "./forecast";

// Two forecast days, hours 12/19/20 — 19 is the clear peak.
const points: ForecastPoint[] = [
  { date: "2026-07-05", hour: 12, predicted: 2 },
  { date: "2026-07-05", hour: 19, predicted: 8 },
  { date: "2026-07-05", hour: 20, predicted: 6 },
  { date: "2026-07-06", hour: 12, predicted: 4 },
  { date: "2026-07-06", hour: 19, predicted: 10 },
  { date: "2026-07-06", hour: 20, predicted: 4 },
];

describe("averageByHour", () => {
  it("averages each hour across dates, ascending by hour", () => {
    expect(averageByHour(points)).toEqual([
      { hour: 12, avgPredicted: 3 },
      { hour: 19, avgPredicted: 9 },
      { hour: 20, avgPredicted: 5 },
    ]);
  });

  it("returns [] for no points", () => {
    expect(averageByHour([])).toEqual([]);
  });
});

describe("computeTop3PeakHours", () => {
  it("ranks the busiest hours first and caps at 3", () => {
    expect(computeTop3PeakHours(points)).toEqual([
      { hour: 19, avgPredicted: 9 },
      { hour: 20, avgPredicted: 5 },
      { hour: 12, avgPredicted: 3 },
    ]);
  });

  it("breaks ties on the earlier hour", () => {
    const tied: ForecastPoint[] = [
      { date: "d", hour: 21, predicted: 5 },
      { date: "d", hour: 13, predicted: 5 },
    ];
    expect(computeTop3PeakHours(tied).map((h) => h.hour)).toEqual([13, 21]);
  });
});
