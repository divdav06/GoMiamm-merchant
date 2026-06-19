"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { isValidCuisine } from "@/lib/cuisines";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

import { isSupportedLanguage } from "./languages";

// Server actions for the merchant settings surface. Same contract as
// menu/actions.ts + hours/actions.ts:
//   1. Verify the caller via checkPartnerAccess (cookie-bridged JWT
//      → restaurant_users.is_active=true).
//   2. Pin the write to the authenticated storeId — never trust a
//      store id coming from the form, so a manager of store A can't
//      mutate store B.
//   3. Use the service-role client so RLS doesn't block writes the
//      caller is already authorized for.
//
// The columns written here mirror exactly what the native Partners app
// edits in lib/storeProfile.ts (the operational write whitelist):
// name, description, address, phone, category, website_url. Sensitive
// columns (commission_rate, is_approved, is_active, ...) are not in
// this surface and stay admin-only.

async function requireAuthed() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  return access;
}

export async function updateStoreProfile(form: FormData): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;
  const website_url = String(form.get("website_url") ?? "").trim() || null;
  // Customer-facing cuisine token (drives home category chips + search).
  // Empty = clear it; any non-empty value must be a known token.
  const rawCuisine = String(form.get("cuisine") ?? "").trim();
  const cuisine = rawCuisine === "" ? null : rawCuisine;
  if (cuisine !== null && !isValidCuisine(cuisine)) throw new Error("Invalid cuisine.");

  // Same required-field rules as the app's saveStoreProfile.
  if (!name) throw new Error("Name is required.");
  if (!address) throw new Error("Address is required.");

  const { error } = await admin
    .from("stores")
    .update({ name, description, address, phone, category, cuisine, website_url })
    .eq("id", access.storeId);
  if (error) throw error;

  revalidatePath("/dashboard/settings");
}

// Writes stores.preferred_language — same column + UPDATE grant the app
// uses in storeProfile.ts setPreferredLanguage. Honored across devices
// and by edge-function emails/notifications + kitchen tickets.
export async function setPreferredLanguage(code: string): Promise<void> {
  const access = await requireAuthed();
  if (!isSupportedLanguage(code)) throw new Error("Unsupported language");
  const admin = createAdminSupabase();

  const { error } = await admin
    .from("stores")
    .update({ preferred_language: code })
    .eq("id", access.storeId);
  if (error) throw error;

  revalidatePath("/dashboard/settings");
}
