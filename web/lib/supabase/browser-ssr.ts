import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for the admin login page. Persists the session to the
 * Supabase cookie (via @supabase/ssr) so server routes/components can read it.
 * Only used client-side on /admin/login.
 */
export function createBrowserSupabase(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
