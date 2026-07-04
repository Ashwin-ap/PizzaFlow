import { describe, it, expect } from "vitest";
import { SYNTHETIC_PHONE_PREFIX, SYNTHETIC_PHONE_LIKE, isSyntheticPhone } from "./synthetic";

describe("synthetic phone tagging", () => {
  it("the prefix is a valid orders.customer_phone start (matches ^[6-9])", () => {
    expect(/^[6-9]/.test(SYNTHETIC_PHONE_PREFIX)).toBe(true);
  });

  it("a full synthetic phone still satisfies the DB CHECK regex", () => {
    const phone = SYNTHETIC_PHONE_PREFIX + "123456";
    expect(phone).toHaveLength(10);
    expect(/^[6-9][0-9]{9}$/.test(phone)).toBe(true);
  });

  it("flags a synthetic-prefixed phone", () => {
    expect(isSyntheticPhone(SYNTHETIC_PHONE_PREFIX + "000001")).toBe(true);
  });

  it("does not flag ordinary phones", () => {
    expect(isSyntheticPhone("9812345678")).toBe(false);
    expect(isSyntheticPhone("6000000000")).toBe(false);
  });

  it("exposes a LIKE pattern for the exclusion filter", () => {
    expect(SYNTHETIC_PHONE_LIKE).toBe("9990%");
  });
});
