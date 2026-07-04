import { describe, it, expect } from "vitest";
import { csvField, ordersToCsv } from "./csv";

describe("csvField — §17 injection guard + RFC-4180", () => {
  it("prefixes formula-leading cells (= + - @ tab) with '", () => {
    for (const lead of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx"]) {
      expect(csvField(lead).startsWith("'")).toBe(true);
    }
  });

  it("guards a CR-leading cell (the ' guard sits inside RFC-4180 quotes)", () => {
    // '\r' triggers BOTH the injection guard and RFC-4180 quoting.
    expect(csvField("\rx")).toBe("\"'\rx\"");
    expect(csvField("\rx")).toContain("'");
  });

  it("quotes comma/quote/newline fields and doubles embedded quotes", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves safe values unquoted", () => {
    expect(csvField("Ravi Kumar")).toBe("Ravi Kumar");
    expect(csvField(586.46)).toBe("586.46");
    expect(csvField(null)).toBe("");
  });

  it("guards THEN quotes when a formula cell also needs quoting", () => {
    // starts with '=' → prefix '  → contains ',' → wrap in quotes
    expect(csvField("=1,2")).toBe("\"'=1,2\"");
  });
});

describe("ordersToCsv", () => {
  it("emits a header + one row per order with rupee decimals + IST time", () => {
    const csv = ordersToCsv([
      {
        id: "o1",
        placed_at: "2026-07-04T12:00:00Z",
        customer_name: "Ravi",
        customer_phone: "9876543210",
        quantity: 1,
        subtotal_paise: 49700,
        discount_paise: 0,
        gst_paise: 8946,
        total_paise: 58646,
        payment_mode: "UPI",
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Order ID");
    expect(lines[0]).toContain("Total (INR)");
    expect(lines[1]).toContain("586.46");
    expect(lines[1]).toContain("Ravi");
    expect(lines[1]).toContain("17:30 IST"); // 12:00Z + 5:30
  });
});
