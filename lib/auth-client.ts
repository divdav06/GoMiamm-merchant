import type { Session } from "@supabase/supabase-js";

import { createBrowserSupabase } from "@/lib/supabase";

// Client-only auth helpers. No next/headers import here — anything in
// this module is safe to ship into the client bundle.

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned from sign-in");
  return data.session;
}

export async function signOut(): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
