import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client (PRD §3, §16.1). BYPASSES RLS — used for writes
 * (the create_order RPC) and the rate-limiter RPC. SERVER ONLY: never import this
 * into a client component; the secret key must never reach the browser bundle.
 */
export const supabaseService: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
