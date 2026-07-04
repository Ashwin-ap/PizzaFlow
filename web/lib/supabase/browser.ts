import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anon (publishable) Supabase client (PRD §3, §16.1) — RLS-guarded, so it can only
 * read the available menu. Safe on the server (e.g. GET /api/menu) or in a browser
 * component. Reads NEXT_PUBLIC_* directly so it never pulls in the server-only env
 * singleton (which hard-exits on misconfig and must stay out of client bundles).
 */
export function createAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
