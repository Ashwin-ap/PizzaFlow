import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 "Proxy" (formerly Middleware) — refreshes the Supabase session cookie on
 * each request so the admin session stays valid. This is an OPTIMISTIC refresh only;
 * real authorization happens in the admin route handlers + the /admin server component
 * (requireAdmin / getAdminPageStatus), per Next's guidance that proxy must not be the
 * authz solution. Mirrors the @supabase/ssr updateSession pattern.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: nothing between createServerClient and getUser() (Supabase guidance).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
