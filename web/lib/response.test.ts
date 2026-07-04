import { describe, it, expect } from "vitest";
import { ok, err, paginated } from "./response";

describe("response envelope", () => {
  it("ok wraps data with success:true and 200", async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { a: 1 } });
  });

  it("ok honours a custom status", () => {
    expect(ok({ x: 1 }, { status: 201 }).status).toBe(201);
  });

  it("err uses the code's canonical status and shape", async () => {
    const res = err("MENU_ITEM_NOT_FOUND", "nope");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "MENU_ITEM_NOT_FOUND", message: "nope" },
    });
  });

  it("attaches fields only on VALIDATION_ERROR", async () => {
    const conflict = err("CONFLICT", "x", { fields: { a: ["b"] } });
    expect((await conflict.json()).error.fields).toBeUndefined();

    const validation = err("VALIDATION_ERROR", "x", {
      fields: { phone: ["bad"] },
    });
    expect((await validation.json()).error.fields).toEqual({ phone: ["bad"] });
  });

  it("paginated computes totalPages", async () => {
    const res = paginated([1, 2], { total: 10, page: 1, limit: 4 });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pagination).toEqual({
      total: 10,
      page: 1,
      limit: 4,
      totalPages: 3,
    });
  });
});
