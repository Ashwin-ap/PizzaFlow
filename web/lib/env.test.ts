import { describe, it, expect } from "vitest";
import { envSchema } from "./env.schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("envSchema", () => {
  it("accepts a valid config and applies :free model defaults", () => {
    const r = envSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      // Scout :free was discontinued upstream → primary is now llama-3.2-3b:free.
      expect(r.data.OPENROUTER_MODEL).toBe("meta-llama/llama-3.2-3b-instruct:free");
      expect(r.data.OPENROUTER_MODEL).toContain(":free");
      expect(r.data.OPENROUTER_FALLBACK_MODEL).toContain(":free");
    }
  });

  it("rejects a missing required var", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...rest } = valid;
    void _omit;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-URL supabase url", () => {
    const r = envSchema.safeParse({
      ...valid,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty secret key", () => {
    const r = envSchema.safeParse({ ...valid, SUPABASE_SECRET_KEY: "" });
    expect(r.success).toBe(false);
  });
});
