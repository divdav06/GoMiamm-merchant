import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Edge middleware. Runs on every /dashboard request — both initial
// page loads AND client-side soft-nav RSC fetches. Three jobs:
//
//   1. Inject x-pathname header so server components can read their
//      own route (used by dashboard/layout.tsx as defense-in-depth).
//   2. Refresh the Supabase session cookie via getUser(); redirect
//      unauthenticated visitors to /login.
//   3. (Phase F.8 + post-mortem on the layout-cache bug) Gate the
//      dashboard on stores.onboarding_status / is_approved. Layouts
//      in App Router don't re-execute on sibling soft navigations
//      (the parent layout's RSC output is reused from the Router
//      Cache), so a layout-only gate can be bypassed by clicking
//      sidebar links. Middleware fires every time and is the
//      authoritative enforcement point.
//
// dashboard/layout.tsx still runs the same gate as a defense-in-
// depth measure — if middleware ever has a bug or gets disabled,
// the layout will still bounce on hard reloads.
export async function middleware(request: NextRequest) {
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

  // ── 1. Auth check — getUser() refreshes the access token if
  //       needed via the refresh token, which is the main side
  //       effect we want here.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // ── 2. Onboarding / approval gate. Mirrors the logic in
  //       dashboard/layout.tsx so the two stay aligned; middleware
  //       is primary, layout is fallback.
  const pathname = request.nextUrl.pathname;
  const onOnboarding = pathname.startsWith("/dashboard/onboarding");
  const onPending = pathname.startsWith("/dashboard/pending");

  // Resolve the user's first active store membership. RLS allows the
  // user to read their own restaurant_users row (user_id = auth.uid()).
  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("store_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.store_id) {
    // Authenticated user with no active store link — same handling as
    // the layout's not_partner path: bounce through sign-out so the
    // cookies clear and they don't loop back in on the next nav.
    return NextResponse.redirect(
      new URL("/api/sign-out?reason=not_partner", request.url),
    );
  }

  // Stores has `USING (true)` RLS so the cookie-scoped client can
  // read it freely.
  const { data: store } = await supabase
    .from("stores")
    .select("onboarding_status, is_approved")
    .eq("id", membership.store_id)
    .maybeSingle();
  const onboardingStatus = (store?.onboarding_status as string | undefined) ?? "not_started";
  const isApproved = !!store?.is_approved;

  // Loop guards: don't redirect a route to itself. Each redirect is
  // only taken when the merchant is NOT already on the destination
  // route family.
  if (onboardingStatus !== "completed" && !onOnboarding) {
    return NextResponse.redirect(new URL("/dashboard/onboarding", request.url));
  }
  if (onboardingStatus === "completed" && !isApproved && !onPending) {
    return NextResponse.redirect(new URL("/dashboard/pending", request.url));
  }
  if (onboardingStatus === "completed" && isApproved && onPending) {
    // Inverse guard: a freshly-approved merchant shouldn't get stuck
    // on /dashboard/pending.
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Only protect /dashboard/*. /login, /signup, /api/sign-out, and
  // static assets stay unguarded.
  matcher: ["/dashboard/:path*"],
};
