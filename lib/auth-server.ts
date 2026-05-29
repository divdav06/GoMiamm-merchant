import { cookies } from "next/headers";
import type { Session } from "@supabase/supabase-js";

import { createServerSupabase } from "@/lib/supabase";

// Server-only auth helpers. Imports next/headers, which must never
// touch the client bundle — that's why this file lives separately from
// lib/auth-client.ts even though both wrap the same Supabase SDK.

export async function getServerSession(): Promise<Session | null> {
  const supabase = createServerSupabase(cookies());
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.id ?? null;
}
