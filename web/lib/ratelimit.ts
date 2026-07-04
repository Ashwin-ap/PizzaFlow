import { supabaseService } from "@/lib/supabase/server";

/**
 * Per-IP rate limiting (PRD §11.5) backed by the durable Supabase `check_rate_limit`
 * RPC — serverless functions share no in-process memory, so an in-memory counter
 * would not work (PRD §17).
 */

/** Best-effort client IP. Vercel sets x-forwarded-for; locally it is absent. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Returns true if the request is ALLOWED (under the limit). Fails OPEN on a limiter
 * error — a hiccup in the counter table must never block a genuine order — but logs it.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabaseService.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limiter error:", error.message);
    return true; // fail-open
  }
  return data === true;
}
