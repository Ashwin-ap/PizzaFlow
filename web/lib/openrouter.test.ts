import { describe, it, expect, vi, afterEach } from "vitest";
import { extractJsonObject, callOpenRouter } from "./openrouter";

describe("extractJsonObject — defensive model-output parsing", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"pizza_code":"P1","topping_code":"T2","reason":"Nice"}')).toEqual({
      pizza_code: "P1",
      topping_code: "T2",
      reason: "Nice",
    });
  });

  it("extracts from a fenced code block", () => {
    const text = 'Sure!\n```json\n{"pizza_code":"P7","topping_code":"T1","reason":"Popular"}\n```';
    expect(extractJsonObject(text)).toEqual({ pizza_code: "P7", topping_code: "T1", reason: "Popular" });
  });

  it("ignores prose before and after the object", () => {
    const text = 'Here you go: {"pizza_code":"P3","topping_code":"T5","reason":"Fresh"} Enjoy!';
    expect((extractJsonObject(text) as { pizza_code: string }).pizza_code).toBe("P3");
  });

  it("does not close early on a brace inside a string value", () => {
    const text = '{"pizza_code":"P1","topping_code":"T2","reason":"Cheesy {melty} goodness"}';
    expect((extractJsonObject(text) as { reason: string }).reason).toBe("Cheesy {melty} goodness");
  });

  it("returns null for malformed JSON or no object", () => {
    expect(extractJsonObject("not json at all")).toBeNull();
    expect(extractJsonObject('{"pizza_code": ')).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });
});

describe("callOpenRouter — model rotation", () => {
  afterEach(() => vi.unstubAllGlobals());
  const res = (status: number, content = "") => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  });
  const messages = [{ role: "user" as const, content: "hi" }];

  it("uses the primary model on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(res(200, "{}"))));
    const r = await callOpenRouter({ apiKey: "k", model: "primary", fallbackModel: "fb", messages });
    expect(r.modelUsed).toBe("primary");
    expect(r.content).toBe("{}");
  });

  it("rotates to the fallback model on a 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200, '{"ok":1}'));
    vi.stubGlobal("fetch", fetchMock);
    const r = await callOpenRouter({ apiKey: "k", model: "primary", fallbackModel: "fb", messages });
    expect(r.modelUsed).toBe("fb");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when both primary and fallback fail", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(res(500))));
    await expect(
      callOpenRouter({ apiKey: "k", model: "primary", fallbackModel: "fb", messages }),
    ).rejects.toThrow(/unavailable/i);
  });
});
