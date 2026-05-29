import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. Server-only — must never be imported
// from a client component or anywhere reachable from the browser
// bundle. Used by Server Actions to bypass RLS on menu_items writes
// and menu-photos uploads.

let cached: SupabaseClient | null = null;

export function createAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not set");
  }
  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
