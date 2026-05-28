import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase clients for the merchant portal. Two flavours because Next.js
// App Router runs the same component code on the server (RSC + actions
// + route handlers) and on the client — they need different
// SDKs / cookie plumbing.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser client ──────────────────────────────────────────────────
// Used in client components ("use client"). Reads/writes session in
// document cookies via @supabase/ssr's browser adapter.
export function createBrowserSupabase(): SupabaseClient {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Server client ───────────────────────────────────────────────────
// Used in Server Components, Route Handlers, and Server Actions. The
// cookieStore argument should be passed in from the caller — Next's
// `cookies()` helper from "next/headers" can only be called inside
// request scope, so we don't import it here at module load.
//
// Usage:
//   import { cookies } from "next/headers";
//   const supabase = createServerSupabase(cookies());
export function createServerSupabase(
  cookieStore: {
    get: (name: string) => { value: string } | undefined;
    set?: (name: string, value: string, options: CookieOptions) => void;
  },
): SupabaseClient {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Server Components can't mutate cookies; this no-ops there and
        // is exercised in Server Actions / Route Handlers where the
        // cookieStore.set is available.
        cookieStore.set?.(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set?.(name, "", { ...options, maxAge: 0 });
      },
    },
  });
}
