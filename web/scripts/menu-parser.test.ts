import { describe, it, expect } from "vitest";
import { parseMenuText } from "./menu-parser";

describe("parseMenuText", () => {
  it("parses valid ID;Name;Price lines to integer paise", () => {
    const items = parseMenuText("B1;Thin Crust;149\nB3;Cheese Burst;229\n");
    expect(items).toEqual([
      { code: "B1", name: "Thin Crust", pricePaise: 14900 },
      { code: "B3", name: "Cheese Burst", pricePaise: 22900 },
    ]);
  });

  it("tolerates a UTF-8 BOM on the first line", () => {
    const items = parseMenuText("﻿B1;Thin Crust;149\n");
    expect(items[0].code).toBe("B1");
  });

  it("skips blank, malformed, non-numeric and non-positive lines", () => {
    const text = [
      "",
      "   ",
      "B1;Thin Crust;149",
      "BROKEN;only-two", // fewer than 3 fields
      "B2;Bad Price;abc", // non-numeric price
      "B3;Free;0", // non-positive
      "B4;Negative;-50", // non-positive
    ].join("\n");
    expect(parseMenuText(text)).toEqual([
      { code: "B1", name: "Thin Crust", pricePaise: 14900 },
    ]);
  });

  it("keeps the first field as code and last as price when the name contains ';'", () => {
    const items = parseMenuText("P1;Cheese; Extra; Large;299\n");
    expect(items[0]).toEqual({
      code: "P1",
      name: "Cheese; Extra; Large",
      pricePaise: 29900,
    });
  });

  it("rounds fractional rupees to paise", () => {
    expect(parseMenuText("T1;Olives;49.5\n")[0].pricePaise).toBe(4950);
  });

  it("trims surrounding whitespace on every field", () => {
    expect(parseMenuText("  B1 ;  Thin Crust ; 149  \n")[0]).toEqual({
      code: "B1",
      name: "Thin Crust",
      pricePaise: 14900,
    });
  });

  it("returns [] when a file has no valid items", () => {
    expect(parseMenuText("garbage\nmore;garbage")).toEqual([]);
  });
});
