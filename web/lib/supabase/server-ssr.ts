import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-bound server Supabase client (PRD §11.5 "admin auth is Supabase-managed").
 * Reads/writes the Supabase session cookie so route handlers + server components see
 * the logged-in admin. Uses the PUBLISHABLE key (RLS applies) — the user's JWT in the
 * cookie is what grants admin reads via is_admin(). Next 16: `cookies()` is async.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (cookies are read-only there) — safe to
            // ignore; the proxy refreshes the session cookie on every request.
          }
        },
      },
    },
  );
}
