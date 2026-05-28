import { cookies } from "next/headers";
import type { Session } from "@supabase/supabase-js";

import { createBrowserSupabase, createServerSupabase } from "@/lib/supabase";

// Auth helpers for the merchant portal. The merchant role itself
// (drivers.role = 'merchant' or whatever the eventual gate is) lives
// in the database; these helpers just resolve the current Supabase
// session and expose sign-in / sign-out for the login screen.

// ── Server-side (Server Components, Server Actions, Route Handlers) ──

export async function getServerSession(): Promise<Session | null> {
  const supabase = createServerSupabase(cookies());
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

// ── Client-side (client components, "use client") ────────────────────

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
