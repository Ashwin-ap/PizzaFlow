// Shared helpers for the standalone seed/provision scripts.
// These run under Node (via `node --import tsx --env-file=.env.local`), NOT inside
// Next.js — so they read process.env directly rather than importing lib/env.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(
      `Missing required env var: ${name}. Run with --env-file=.env.local (or export it).`,
    );
    process.exit(1);
  }
  return v;
}

/** Service-role client — bypasses RLS. Server/CLI only, never the browser. */
export function serviceClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
