import { createHash, timingSafeEqual } from "node:crypto";
import { ok, err } from "@/lib/response";
import { env } from "@/lib/env";

// POST /api/cron/forecast (PRD §11.3, §13.2) — cron-secret guarded. Triggers the Python
// forecast service's /train, which retrains and writes demand_forecasts. Wired to Vercel
// Cron (daily) in Phase 8; runnable locally against a uvicorn instance. This route never
// runs Python itself — it's a thin, authenticated trigger.
export const dynamic = "force-dynamic";

/** Constant-time compare via fixed-length SHA-256 digests (timingSafeEqual needs equal length). */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    if (!env.CRON_SECRET) return err("INTERNAL", "Cron is not configured.");

    const provided = request.headers.get("x-cron-secret") ?? "";
    if (!secretMatches(provided, env.CRON_SECRET)) {
      return err("UNAUTHENTICATED", "Invalid cron secret.");
    }

    if (!env.FORECAST_SERVICE_URL || !env.FORECAST_SERVICE_TOKEN) {
      return err("INTERNAL", "Forecast service is not configured.");
    }

    const res = await fetch(`${env.FORECAST_SERVICE_URL}/train`, {
      method: "POST",
      headers: { "x-forecast-token": env.FORECAST_SERVICE_TOKEN },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.error(`forecast /train failed: ${res.status}`);
      return err("INTERNAL", `Forecast training failed (${res.status}).`);
    }
    return ok(await res.json());
  } catch (e) {
    console.error("cron/forecast route error:", e);
    return err("INTERNAL", "Forecast service unreachable.");
  }
}
