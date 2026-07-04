// @vitest-environment node
//
// Live integration test for the admin routes. Calls the route handlers directly with a
// Bearer token (the handlers' server-side fallback), against the hosted Supabase project.
// OPT-IN: runs only when Supabase creds AND ADMIN_EMAIL/ADMIN_PASSWORD are present.
//
//   npm run test:admin
//
// The browser uses cookies; these tests use Bearer so they can run headless.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const hasCreds = Boolean(url && anonKey && secretKey && adminEmail && adminPassword);

describe.skipIf(!hasCreds)("admin routes (live DB)", () => {
  let ordersGET: (req: Request) => Promise<Response>;
  let metricsGET: (req: Request) => Promise<Response>;
  let exportGET: (req: Request) => Promise<Response>;
  let service: SupabaseClient;
  let adminToken: string;
  let nonAdminToken: string;
  let nonAdminId: string;

  const req = (path: string, token?: string) =>
    new Request(`http://localhost${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    ({ GET: ordersGET } = await import("@/app/api/admin/orders/route"));
    ({ GET: metricsGET } = await import("@/app/api/admin/metrics/route"));
    ({ GET: exportGET } = await import("@/app/api/admin/export/route"));
    service = createClient(url!, secretKey!, { auth: { persistSession: false } });

    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const admin = await anon.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! });
    if (admin.error) throw new Error(`admin sign-in failed: ${admin.error.message}`);
    adminToken = admin.data.session!.access_token;

    // A throwaway non-admin user (created + signed in + cleaned up).
    const email = `nonadmin-${crypto.randomUUID()}@slicematic.test`;
    const password = "N0n@dmin-pw!";
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`create non-admin failed: ${created.error.message}`);
    nonAdminId = created.data.user!.id;
    const nonAdmin = await anon.auth.signInWithPassword({ email, password });
    nonAdminToken = nonAdmin.data.session!.access_token;
  });

  afterAll(async () => {
    if (nonAdminId) await service.auth.admin.deleteUser(nonAdminId);
  });

  it("no/invalid session → 401 UNAUTHENTICATED", async () => {
    const res = await ordersGET(req("/api/admin/orders", "not-a-real-token"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("authenticated non-admin → 403 FORBIDDEN", async () => {
    const res = await ordersGET(req("/api/admin/orders", nonAdminToken));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("admin → 200 paginated orders", async () => {
    const res = await ordersGET(req("/api/admin/orders?page=1&limit=5", adminToken));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.pagination).toMatchObject({ page: 1, limit: 5 });
    expect(typeof json.pagination.totalPages).toBe("number");
  });

  it("admin → 200 metrics with the expected shape", async () => {
    const res = await metricsGET(req("/api/admin/metrics", adminToken));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(typeof data.revenuePaise).toBe("number");
    expect(typeof data.orderCount).toBe("number");
    expect("topPizza" in data && "busiestHour" in data).toBe(true);
  });

  it("admin → 200 CSV export (attachment)", async () => {
    const res = await exportGET(req("/api/admin/export", adminToken));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect((await res.text()).split("\r\n")[0]).toContain("Order ID");
  });

  it("non-admin is blocked on metrics + export too", async () => {
    expect((await metricsGET(req("/api/admin/metrics", nonAdminToken))).status).toBe(403);
    expect((await exportGET(req("/api/admin/export", nonAdminToken))).status).toBe(403);
  });
});
