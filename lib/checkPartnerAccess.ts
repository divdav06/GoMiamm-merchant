import { cookies } from "next/headers";

import { createServerSupabase } from "@/lib/supabase";

export type PartnerAccess = {
  userId: string;
  email: string | null;
  storeId: string;
  storeName: string;
  role: "owner" | "manager" | "staff";
};

// Server-side gate for the merchant portal. Returns the resolved
// (user, store, role) tuple when the signed-in user has an active
// restaurant_users row, or null when they don't — the caller decides
// how to bounce them (redirect to /login?error=not_partner, etc.).
//
// We pick the user's FIRST active membership for now; phase E step 4
// will add a store switcher when a user belongs to multiple stores.
export async function checkPartnerAccess(): Promise<PartnerAccess | null> {
  const supabase = createServerSupabase(cookies());

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership, error } = await supabase
    .from("restaurant_users")
    .select("store_id, role, store:stores(id, name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !membership) return null;

  // Supabase typings collapse the joined `store` to an array when
  // PostgREST can't prove the relationship is 1:1; defensively support
  // both shapes.
  const store = Array.isArray(membership.store) ? membership.store[0] : membership.store;
  if (!store) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    storeId: store.id,
    storeName: store.name,
    role: membership.role as PartnerAccess["role"],
  };
}
