"use server";

import { revalidatePath } from "next/cache";

import type { BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import type { OperationsInfo } from "@/components/onboarding/OperationsStep";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

import { checkAccountStatus, createConnectAccount } from "../payouts/actions";

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

export async function saveOperationsInfo(data: OperationsInfo): Promise<void> {
  const access = await requireOwner();

  // Server-side re-validation. Client gates on the same conditions but
  // can be bypassed.
  if (!String(data.cuisine_type ?? "").trim()) {
    throw new Error("cuisine_type required");
  }
  if (!Number.isFinite(data.kitchen_capacity) || data.kitchen_capacity <= 0) {
    throw new Error("kitchen_capacity must be a positive number");
  }
  if (!Number.isFinite(data.delivery_radius_km) || data.delivery_radius_km <= 0) {
    throw new Error("delivery_radius_km must be a positive number");
  }

  const normalized: OperationsInfo = {
    cuisine_type: data.cuisine_type.trim(),
    kitchen_capacity: data.kitchen_capacity,
    delivery_radius_km: data.delivery_radius_km,
  };

  const admin = createAdminSupabase();

  // Upsert keyed on store_id UNIQUE; touch only operations_info +
  // current_step + updated_at so business_info / banking_info on an
  // existing row stay intact.
  const { error: upsertErr } = await admin
    .from("restaurant_signups")
    .upsert(
      {
        store_id: access.storeId,
        operations_info: normalized,
        current_step: "banking",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id" },
    );
  if (upsertErr) throw upsertErr;

  // Race-safe advance: only bump 'operations' → 'banking'. If the
  // merchant has somehow already moved past banking, leave them.
  const { error: storeErr } = await admin
    .from("stores")
    .update({ onboarding_status: "banking" })
    .eq("id", access.storeId)
    .in("onboarding_status", ["operations"]);
  if (storeErr) throw storeErr;

  revalidatePath("/dashboard/onboarding");
}

// Thin wrappers around the phase E.7 payouts actions — same Stripe
// logic, just routed back to /dashboard/onboarding so the merchant
// lands on the BankingStep card after Stripe-hosted onboarding.

export async function startBankingOnboarding(): Promise<{ url: string }> {
  // requireOwner gate is enforced by createConnectAccount's own
  // requireAuthed (manager-or-owner). The onboarding funnel itself is
  // gated owner-only at the page level, so the manager fork there
  // doesn't apply — defense in depth.
  await requireOwner();
  return createConnectAccount({ returnTo: "/dashboard/onboarding" });
}

export async function refreshBankingStatus(): Promise<{
  payouts_enabled: boolean;
  charges_enabled: boolean;
  requirements_due: string[];
} | null> {
  await requireOwner();
  const result = await checkAccountStatus();
  // checkAccountStatus already revalidates /dashboard/payouts; we
  // additionally revalidate /dashboard/onboarding so the server
  // component re-fetches the new payouts_enabled value the next time
  // the client router.refresh()es.
  revalidatePath("/dashboard/onboarding");
  return result;
}

export async function completeBanking(): Promise<void> {
  const access = await requireOwner();
  const admin = createAdminSupabase();

  // Gate the advance on Stripe Connect actually having flipped
  // payouts_enabled to true on our mirrored row. The
  // restaurants_payout_accounts row is kept in sync by
  // checkAccountStatus() (called on Stripe-return) and by the stripe
  // webhook on account.updated events. If neither has fired yet, the
  // merchant came back here before Stripe finished verifying — bounce
  // them with a clear error so they re-run the Connect flow.
  const { data: payoutRow, error: payoutErr } = await admin
    .from("restaurants_payout_accounts")
    .select("payouts_enabled")
    .eq("store_id", access.storeId)
    .maybeSingle();
  if (payoutErr) throw payoutErr;
  if (!payoutRow?.payouts_enabled) {
    throw new Error("Stripe hasn't confirmed your payouts are enabled yet. Finish the Stripe setup, then try again.");
  }

  // Race-safe advance: only bump 'banking' → 'contract_pending'. If
  // the merchant has somehow already moved past contract_pending, the
  // WHERE clause silently no-ops.
  const { error: storeErr } = await admin
    .from("stores")
    .update({ onboarding_status: "contract_pending" })
    .eq("id", access.storeId)
    .in("onboarding_status", ["banking"]);
  if (storeErr) throw storeErr;

  revalidatePath("/dashboard/onboarding");
}
