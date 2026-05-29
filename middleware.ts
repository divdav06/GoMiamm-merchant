import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Edge middleware. Refreshes the Supabase session cookie on every
// /dashboard request and redirects to /login when no session exists.
// The deeper "is this user a partner?" check lives in
// app/dashboard/layout.tsx — we don't query restaurant_users from the
// edge runtime to keep middleware fast and DB-free.

export async function middleware(request: NextRequest) {
  // Inject the current pathname as an x-pathname header so server
  // components (which don't have access to next/navigation's
  // usePathname) can read their own route. Used by the dashboard
  // layout's onboarding-redirect loop guard.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Mutate both the request (so the downstream handler sees the
          // refreshed cookie) and the response (so the browser stores
          // the new value). Re-pass requestHeaders so x-pathname stays
          // attached across the refresh.
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // getUser() will silently refresh an expired access token via the
  // refresh token, which is the main side effect we want here.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Only protect /dashboard/*. /login, /api/sign-out, and static assets
  // stay unguarded.
  matcher: ["/dashboard/:path*"],
};
