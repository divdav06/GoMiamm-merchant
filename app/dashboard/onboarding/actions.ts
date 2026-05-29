"use server";

import { revalidatePath } from "next/cache";

import type { BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Onboarding flow lives behind two gates today:
//   1. Authenticated partner (checkPartnerAccess — same as everywhere
//      else on /dashboard/*).
//   2. Owner role only — banking + contract authority isn't something
//      a manager or staff should hold, and the onboarding funnel
//      leads directly into both of those.
//
// Writes go through createAdminSupabase (service-role) because
// restaurants_signups RLS already gates owner reads/writes server-
// side, but we still want a single coherent path with the rest of
// the merchant portal's mutations.

async function requireOwner() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  if (access.role !== "owner") {
    throw new Error("Only owners can complete onboarding");
  }
  return access;
}

export async function saveBusinessInfo(data: BusinessInfo): Promise<void> {
  const access = await requireOwner();

  // Server-side validation mirroring the client form's required-field
  // gating. Client can be bypassed; server cannot.
  const required: (keyof BusinessInfo)[] = ["legal_name", "address", "phone", "tax_id"];
  for (const k of required) {
    if (!String(data[k] ?? "").trim()) {
      throw new Error(`${k} required`);
    }
  }

  const normalized: BusinessInfo = {
    legal_name: data.legal_name.trim(),
    dba: data.dba.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    tax_id: data.tax_id.trim(),
  };

  const admin = createAdminSupabase();

  // Upsert keyed on store_id (UNIQUE constraint, see phase F.1
  // migration). operations_info / banking_info on an existing row are
  // left untouched — only the business_info block is replaced.
  const { error: upsertErr } = await admin
    .from("restaurant_signups")
    .upsert(
      {
        store_id: access.storeId,
        business_info: normalized,
        current_step: "operations",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id" },
    );
  if (upsertErr) throw upsertErr;

  // Race-safe advance: only bump status to 'operations' if it's still
  // at one of the pre-operations states. A merchant who's already
  // past business_info (e.g. came back to edit) keeps their further-
  // along status — the WHERE clause silently no-ops the update.
  const { error: storeErr } = await admin
    .from("stores")
    .update({ onboarding_status: "operations" })
    .eq("id", access.storeId)
    .in("onboarding_status", ["not_started", "business_info"]);
  if (storeErr) throw storeErr;

  revalidatePath("/dashboard/onboarding");
}
