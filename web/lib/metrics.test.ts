import { describe, it, expect } from "vitest";
import {
  computeRevenuePaise,
  topSellingPizza,
  busiestHourIST,
  istHour,
  istDateTime,
  orderCount,
  formatHourIST,
} from "./metrics";

describe("computeRevenuePaise", () => {
  it("sums total_paise (integer paise)", () => {
    expect(computeRevenuePaise([{ total_paise: 58646 }, { total_paise: 359487 }])).toBe(418133);
    expect(computeRevenuePaise([])).toBe(0);
  });
});

describe("topSellingPizza", () => {
  it("returns the most-sold pizza by line-item count", () => {
    expect(
      topSellingPizza([{ pizza_name: "BBQ" }, { pizza_name: "Margherita" }, { pizza_name: "BBQ" }]),
    ).toEqual({ name: "BBQ", count: 2 });
  });
  it("ignores blanks and returns null when empty", () => {
    expect(topSellingPizza([{ pizza_name: null }])).toBeNull();
    expect(topSellingPizza([])).toBeNull();
  });
});

describe("istHour — UTC → IST (+5:30, no DST)", () => {
  it("converts, including crossing midnight", () => {
    expect(istHour("2026-07-04T19:30:00Z")).toBe(1); // 01:00 IST next day
    expect(istHour("2026-07-04T06:30:00Z")).toBe(12); // noon IST
    expect(istHour("2026-07-04T00:00:00Z")).toBe(5); // 05:30 IST → hour 5
  });
});

describe("busiestHourIST", () => {
  it("finds the busiest IST hour", () => {
    expect(
      busiestHourIST([
        { placed_at: "2026-07-04T13:30:00Z" }, // 19:00 IST
        { placed_at: "2026-07-04T13:45:00Z" }, // 19:15 IST
        { placed_at: "2026-07-04T06:30:00Z" }, // 12:00 IST
      ]),
    ).toEqual({ hour: 19, count: 2 });
    expect(busiestHourIST([])).toBeNull();
  });
});

describe("istDateTime / formatHourIST / orderCount", () => {
  it("formats an IST wall-clock string", () => {
    expect(istDateTime("2026-07-04T12:00:00Z")).toBe("2026-07-04 17:30 IST");
  });
  it("formats a 12-hour clock label", () => {
    expect(formatHourIST(0)).toBe("12 AM");
    expect(formatHourIST(12)).toBe("12 PM");
    expect(formatHourIST(19)).toBe("7 PM");
  });
  it("counts orders", () => {
    expect(orderCount([1, 2, 3])).toBe(3);
  });
});
