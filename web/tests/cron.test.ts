// @vitest-environment node
//
// Unit test for POST /api/cron/forecast. Runs in CI (no DB needed): the env is stubbed and
// the outbound fetch to the forecast service is mocked. Verifies the cron-secret gate — for
// BOTH the Vercel Cron path (`Authorization: Bearer <CRON_SECRET>`) and the manual
// `x-cron-secret` fallback — and that a valid call proxies to the service's /train.
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// The route imports the validated env singleton, which parses at import time — populate it
// with valid values BEFORE dynamically importing the route below.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";
process.env.FORECAST_SERVICE_URL = "http://localhost:8000";
process.env.FORECAST_SERVICE_TOKEN = "test-forecast-token";

const CRON_SECRET = "test-cron-secret";

describe("POST /api/cron/forecast", () => {
  let POST: (req: Request) => Promise<Response>;

  const req = (headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/cron/forecast", { method: "POST", headers });
  const bearer = (secret: string) => req({ authorization: `Bearer ${secret}` });

  const okFetch = (summary: unknown) =>
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => summary }));

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/cron/forecast/route"));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("rejects a missing secret with 401 and never calls the service", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a wrong Bearer secret with 401", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(bearer("wrong-secret"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts the Vercel Cron `Authorization: Bearer` header and proxies to /train", async () => {
    const summary = { model: "rf-v1", rfRmse: 1.2, linRmse: 1.8, rowsWritten: 84 };
    const fetchSpy = okFetch(summary);
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(bearer(CRON_SECRET));
    expect(res.status).toBe(200);
    const { success, data } = await res.json();
    expect(success).toBe(true);
    expect(data).toMatchObject(summary);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/train");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-forecast-token"]).toBe("test-forecast-token");
  });

  it("also accepts the manual `x-cron-secret` fallback header", async () => {
    const fetchSpy = okFetch({ model: "rf-v1", rowsWritten: 84 });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(req({ "x-cron-secret": CRON_SECRET }));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the service responds non-OK", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const res = await POST(bearer(CRON_SECRET));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL");
  });
});
