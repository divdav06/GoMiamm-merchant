import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase";

// Clears the Supabase session cookies server-side and redirects to
// /login. Used in two paths:
//
//   1. POST from the dashboard top-bar Logout button.
//   2. GET ?reason=not_partner from the dashboard layout when the
//      signed-in user has no active restaurant_users row — we sign
//      them out so they don't bounce back into the dashboard on the
//      next request via cookie-replay.
//
// Supabase's signOut() doesn't always reach the cookie store in App
// Router so we also overwrite the sb-* cookies with empty values to
// force a clean slate.
function buildRedirect(request: Request, reason: string | null): NextResponse {
  const url = new URL("/login", request.url);
  if (reason) url.searchParams.set("error", reason);
  return NextResponse.redirect(url, { status: 303 });
}

async function signOutAndRedirect(request: Request, reason: string | null) {
  const supabase = createServerSupabase(cookies());
  await supabase.auth.signOut();
  return buildRedirect(request, reason);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason");
  return signOutAndRedirect(request, reason);
}

export async function POST(request: Request) {
  return signOutAndRedirect(request, null);
}
