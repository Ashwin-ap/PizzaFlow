import { ok, err } from "@/lib/response";
import { env } from "@/lib/env";

// Readiness probe — light Supabase reachability check (PRD §11.3 / §11.5).
// Schema-independent (works before any tables exist); tighten to a menu_items
// head-query after Phase 2. Uncached; never rate-limited.
export const dynamic = "force-dynamic";

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return err("INTERNAL", "Supabase not ready", { status: 503 });
    }
    return ok({ ready: true });
  } catch {
    return err("INTERNAL", "Supabase unreachable", { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
