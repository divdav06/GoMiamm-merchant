"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

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

  // Same required-field rules as the app's saveStoreProfile.
  if (!name) throw new Error("Name is required.");
  if (!address) throw new Error("Address is required.");

  const { error } = await admin
    .from("stores")
    .update({ name, description, address, phone, category, website_url })
    .eq("id", access.storeId);
  if (error) throw error;

  revalidatePath("/dashboard/settings");
}
