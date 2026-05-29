"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import {
  createAccountOnboardingLink,
  createConnectedPayout,
  createExpressAccount,
  getAccount,
  getConnectedBalance,
} from "@/lib/stripe";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

const TABLE = "restaurants_payout_accounts";

async function requireAuthed() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  if (access.role !== "owner" && access.role !== "manager") {
    throw new Error("Only owners and managers can manage payouts");
  }
  return access;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

// Create the Connect Express account if it doesn't exist yet, then
// mint a fresh onboarding link and return its URL. Idempotent on the
// account-creation half; the onboarding link is single-use + short-
// lived per Stripe and minted fresh every call.
export async function createConnectAccount(): Promise<{ url: string }> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from(TABLE)
    .select("stripe_account_id")
    .eq("store_id", access.storeId)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;
  if (!accountId) {
    const acct = await createExpressAccount({
      store_id: access.storeId,
      store_name: access.storeName,
      created_by_user_id: access.userId,
    });
    accountId = acct.id;
    const { error } = await admin
      .from(TABLE)
      .upsert(
        {
          store_id: access.storeId,
          stripe_account_id: accountId,
          payouts_enabled: !!acct.payouts_enabled,
          charges_enabled: !!acct.charges_enabled,
          requirements_due: acct.requirements?.currently_due ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
    if (error) throw error;
  }

  const link = await createAccountOnboardingLink(
    accountId,
    `${baseUrl()}/dashboard/payouts?stripe=refresh`,
    `${baseUrl()}/dashboard/payouts?stripe=return`,
  );
  revalidatePath("/dashboard/payouts");
  return { url: link.url };
}

// Pull the latest account state from Stripe and sync our row.
// Called from the page on render (after a Connect-return navigation)
// and from the "Refresh status" button.
export async function checkAccountStatus(): Promise<{
  payouts_enabled: boolean;
  charges_enabled: boolean;
  requirements_due: string[];
} | null> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: row } = await admin
    .from(TABLE)
    .select("stripe_account_id")
    .eq("store_id", access.storeId)
    .maybeSingle();
  if (!row?.stripe_account_id) return null;

  const acct = await getAccount(row.stripe_account_id);
  const requirements_due = acct.requirements?.currently_due ?? [];
  const { error } = await admin
    .from(TABLE)
    .update({
      payouts_enabled: !!acct.payouts_enabled,
      charges_enabled: !!acct.charges_enabled,
      requirements_due,
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", access.storeId);
  if (error) throw error;

  revalidatePath("/dashboard/payouts");
  return {
    payouts_enabled: !!acct.payouts_enabled,
    charges_enabled: !!acct.charges_enabled,
    requirements_due,
  };
}

// Initiate an instant manual payout for the entire available balance
// on the connected account. Useful for owners who want their money out
// today rather than waiting for the automatic Monday-04:00 cron.
export async function requestManualPayout(): Promise<{ id: string; amount: number }> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: row } = await admin
    .from(TABLE)
    .select("stripe_account_id, payouts_enabled")
    .eq("store_id", access.storeId)
    .maybeSingle();
  if (!row?.stripe_account_id) throw new Error("No Stripe account on file");
  if (!row.payouts_enabled) throw new Error("Payouts not yet enabled on this account");

  const balance = await getConnectedBalance(row.stripe_account_id);
  // Default to USD; Stripe returns each currency separately. Phase E
  // is US-only — when we open CA / FR, this becomes a loop over the
  // available[] array per currency.
  const usd = balance.available.find((a) => a.currency.toLowerCase() === "usd");
  if (!usd || usd.amount <= 0) {
    throw new Error("No available USD balance to pay out");
  }

  const payout = await createConnectedPayout(row.stripe_account_id, usd.amount, usd.currency);
  revalidatePath("/dashboard/payouts");
  return { id: payout.id, amount: payout.amount };
}
