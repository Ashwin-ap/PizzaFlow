import type { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { err } from "@/lib/response";

/**
 * Admin gate (PRD §11.5 / §17). A caller is admin iff they have a valid Supabase
 * session AND `is_admin()` is true. Everything is Supabase-managed — no hand-rolled
 * auth. The returned `supabase` carries the user's JWT, so RLS-gated admin reads run
 * through it (a non-admin literally can't read `orders`).
 *
 * Transport: the browser uses the session COOKIE. A server-side `Authorization: Bearer`
 * token is also accepted — used ONLY by the opt-in integration tests (which call the
 * handlers directly and can't set cookies). The browser never sends it.
 */
export interface AdminContext {
  user: User;
  supabase: SupabaseClient;
}

function tokenClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

async function resolveCaller(
  request: Request,
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const authz = request.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice(7).trim();
    const supabase = tokenClient(token);
    const { data } = await supabase.auth.getUser(token);
    return { user: data.user ?? null, supabase };
  }
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null, supabase };
}

async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/**
 * Route-handler gate. Returns the AdminContext on success, or a ready-to-return
 * NextResponse (401 UNAUTHENTICATED / 403 FORBIDDEN). Call sites:
 *   const gate = await requireAdmin(request);
 *   if (gate instanceof NextResponse) return gate;
 *   const { supabase, user } = gate;
 */
export async function requireAdmin(request: Request): Promise<AdminContext | NextResponse> {
  const { user, supabase } = await resolveCaller(request);
  if (!user) return err("UNAUTHENTICATED", "Sign in to continue.");
  if (!(await isAdmin(supabase))) return err("FORBIDDEN", "Admin access required.");
  return { user, supabase };
}

/** Server-component gate for /admin (cookie session only). */
export type AdminPageStatus =
  | { ok: true; user: User }
  | { ok: false; reason: "unauthed" | "forbidden" };

export async function getAdminPageStatus(): Promise<AdminPageStatus> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthed" };
  if (!(await isAdmin(supabase))) return { ok: false, reason: "forbidden" };
  return { ok: true, user };
}
