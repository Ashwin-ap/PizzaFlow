// @vitest-environment node
//
// Live RLS + seed-integrity integration test. Hits the hosted Supabase project, so
// it is OPT-IN: it runs only when Supabase creds are present in the environment
// (which they are not in CI, and not in a plain `npm test`). Run it locally with:
//
//   npm run test:rls        (loads web/.env.local and targets this file)
//
// It asserts the Phase 2 security invariants: anon reads the menu, anon cannot read
// or write orders, and the menu upsert is idempotent.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseMenuText } from "../scripts/menu-parser";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const hasCreds = Boolean(url && anonKey && secretKey);

describe.skipIf(!hasCreds)("RLS + seed integrity (live Supabase)", () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let probeOrderId: string | null = null;

  beforeAll(() => {
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    if (probeOrderId) await service.from("orders").delete().eq("id", probeOrderId);
  });

  it("anon can read available menu items", async () => {
    const { data, error } = await anon
      .from("menu_items")
      .select("code,category,price_paise")
      .eq("is_available", true);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("anon CANNOT read orders (RLS filters to zero rows)", async () => {
    // Seed one real order via the service role (bypasses RLS) so there is something to hide.
    const { data: inserted, error: insErr } = await service
      .from("orders")
      .insert({
        customer_name: "RLS Probe",
        customer_phone: "9000000000",
        quantity: 1,
        subtotal_paise: 10000,
        discount_paise: 0,
        discount_applied: false,
        gst_paise: 1800,
        total_paise: 11800,
        payment_mode: "Cash",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    probeOrderId = inserted!.id;

    const { data, error } = await anon.from("orders").select("id");
    expect(error).toBeNull(); // no SELECT policy for anon → no error, just no rows
    expect(data ?? []).toHaveLength(0);
  });

  it("anon CANNOT insert an order (RLS denies the write)", async () => {
    const { error } = await anon.from("orders").insert({
      customer_name: "Should Fail",
      customer_phone: "9000000001",
      quantity: 1,
      subtotal_paise: 10000,
      gst_paise: 1800,
      total_paise: 11800,
      payment_mode: "Cash",
    });
    expect(error).not.toBeNull();
  });

  it("menu upsert is idempotent (re-seed keeps the same available count)", async () => {
    const files = [
      { category: "base", file: "Types_of_Base.txt" },
      { category: "pizza", file: "Types_of_Pizza.txt" },
      { category: "topping", file: "Types_of_Toppings.txt" },
    ] as const;
    const root = resolve(import.meta.dirname, "..", "..");

    const availableCount = async () => {
      const { count } = await service
        .from("menu_items")
        .select("*", { count: "exact", head: true })
        .eq("is_available", true);
      return count ?? 0;
    };

    const before = await availableCount();
    for (const { category, file } of files) {
      const items = parseMenuText(readFileSync(join(root, file), "utf8"));
      const rows = items.map((it, i) => ({
        category,
        code: it.code,
        name: it.name,
        price_paise: it.pricePaise,
        is_available: true,
        sort_order: i,
      }));
      const { error } = await service
        .from("menu_items")
        .upsert(rows, { onConflict: "category,code" });
      expect(error).toBeNull();
    }
    const after = await availableCount();

    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
  });
});
