// @vitest-environment node
//
// Live integration test for GET /api/admin/forecast. Calls the handler directly with a
// Bearer token, against the hosted Supabase project. OPT-IN: runs only when Supabase creds
// AND ADMIN_EMAIL/ADMIN_PASSWORD are present.
//
//   npm run test:forecast
//
// Seeds a throwaway forecast run (service role), asserts the 401/403/200 gate + shape, and
// cleans up. Mirrors tests/admin.integration.test.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const hasCreds = Boolean(url && anonKey && secretKey && adminEmail && adminPassword);

describe.skipIf(!hasCreds)("admin forecast route (live DB)", () => {
  let forecastGET: (req: Request) => Promise<Response>;
  let service: SupabaseClient;
  let adminToken: string;
  let nonAdminToken: string;
  let nonAdminId: string;
  let generatedAt: string;

  const req = (path: string, token?: string) =>
    new Request(`http://localhost${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    ({ GET: forecastGET } = await import("@/app/api/admin/forecast/route"));
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });

    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const admin = await anon.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! });
    if (admin.error) throw new Error(`admin sign-in failed: ${admin.error.message}`);
    adminToken = admin.data.session!.access_token;

    const email = `nonadmin-${crypto.randomUUID()}@slicematic.test`;
    const password = "N0n@dmin-pw!";
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`create non-admin failed: ${created.error.message}`);
    nonAdminId = created.data.user!.id;
    nonAdminToken = (await anon.auth.signInWithPassword({ email, password })).data.session!.access_token;

    // Seed a small throwaway forecast run.
    generatedAt = new Date().toISOString();
    const rows = [11, 12, 19, 20].map((hour) => ({
      generated_at: generatedAt,
      target_date: "2999-01-01",
      hour_of_day: hour,
      predicted_orders: hour === 20 ? 9.5 : 3.0,
      model_version: "rf-test",
      rmse: 1.234,
    }));
    const { error } = await service.from("demand_forecasts").insert(rows);
    if (error) throw new Error(`seed forecast failed: ${error.message}`);
  });

  afterAll(async () => {
    if (generatedAt) await service.from("demand_forecasts").delete().eq("generated_at", generatedAt);
    if (nonAdminId) await service.auth.admin.deleteUser(nonAdminId);
  });

  it("no/invalid session → 401 UNAUTHENTICATED", async () => {
    const res = await forecastGET(req("/api/admin/forecast", "not-a-real-token"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("authenticated non-admin → 403 FORBIDDEN", async () => {
    const res = await forecastGET(req("/api/admin/forecast", nonAdminToken));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("admin → 200 with the forecast shape", async () => {
    const res = await forecastGET(req("/api/admin/forecast", adminToken));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data.points)).toBe(true);
    expect(Array.isArray(data.top3PeakHours)).toBe(true);
    expect("generatedAt" in data && "model" in data && "rmse" in data).toBe(true);
    for (const p of data.points) {
      expect(typeof p.hour).toBe("number");
      expect(typeof p.predicted).toBe("number");
    }
  });
});
