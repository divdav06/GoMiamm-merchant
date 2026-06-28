"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import {
  createAccountOnboardingLink,
  createConnectedPayout,
  createExpressAccount,
  getAccount,
  getConnectedBalance,
  regionForCountry,
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
//
// `returnTo` optionally overrides where Stripe sends the merchant on
// completion / refresh (default: /dashboard/payouts). The onboarding
// funnel (phase F.5) overrides to /dashboard/onboarding so the
// merchant lands back on the BankingStep card after finishing Stripe.
export async function createConnectAccount(
  opts?: { returnTo?: string },
): Promise<{ url: string }> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from(TABLE)
    .select("stripe_account_id, stripe_account_region")
    .eq("store_id", access.storeId)
    .maybeSingle();

  // Store country drives which platform owns the Connect account
  // (Stripe US/FR routing #3): FR -> SASU, US/CA -> US LLC. Falls back
  // to "US" when the store has no country_code yet -> byte-identical.
  const { data: store } = await admin
    .from("stores")
    .select("country_code")
    .eq("id", access.storeId)
    .maybeSingle();
  const countryCode = store?.country_code ?? "US";
  const region = regionForCountry(countryCode);

  let accountId = existing?.stripe_account_id ?? null;
  if (!accountId) {
    const acct = await createExpressAccount({
      store_id: access.storeId,
      store_name: access.storeName,
      created_by_user_id: access.userId,
    }, countryCode);
    accountId = acct.id;
    const { error } = await admin
      .from(TABLE)
      .upsert(
        {
          store_id: access.storeId,
          stripe_account_id: accountId,
          stripe_account_region: region,
          payouts_enabled: !!acct.payouts_enabled,
          charges_enabled: !!acct.charges_enabled,
          requirements_due: acct.requirements?.currently_due ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
    if (error) throw error;
  }

  // Mint the onboarding link on the platform that owns the acct_. Prefer
  // the region pinned at creation; fall back to the store's country.
  const linkRegion = existing?.stripe_account_region ?? region;
  const returnPath = opts?.returnTo ?? "/dashboard/payouts";
  const link = await createAccountOnboardingLink(
    accountId,
    `${baseUrl()}${returnPath}?stripe=refresh`,
    `${baseUrl()}${returnPath}?stripe=return`,
    linkRegion,
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
    .select("stripe_account_id, stripe_account_region")
    .eq("store_id", access.storeId)
    .maybeSingle();
  if (!row?.stripe_account_id) return null;

  // Read the connected account on the platform that owns it (#6).
  const acct = await getAccount(row.stripe_account_id, row.stripe_account_region ?? "US");
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
    .select("stripe_account_id, payouts_enabled, stripe_account_region")
    .eq("store_id", access.storeId)
    .maybeSingle();
  if (!row?.stripe_account_id) throw new Error("No Stripe account on file");
  if (!row.payouts_enabled) throw new Error("Payouts not yet enabled on this account");

  // Region pinned at account creation (#6): the balance read and the
  // payout (MONEY PATH) must both originate from the platform that owns
  // the acct_ — FR store -> SASU, US/CA -> US LLC. Existing rows = 'US'.
  const region = row.stripe_account_region ?? "US";

  const balance = await getConnectedBalance(row.stripe_account_id, region);
  // Settlement currency is one-per-store, derived from the account's
  // region (FR SASU settles EUR; US LLC settles USD). Pick that single
  // currency's available balance — Stripe returns each currency
  // separately. (Single-currency stores: no need to loop over all.)
  const expectedCurrency = region === "FR" ? "eur" : "usd";
  const funds = balance.available.find((a) => a.currency.toLowerCase() === expectedCurrency);
  if (!funds || funds.amount <= 0) {
    throw new Error(`No available ${expectedCurrency.toUpperCase()} balance to pay out`);
  }

  const payout = await createConnectedPayout(row.stripe_account_id, funds.amount, funds.currency, region);
  revalidatePath("/dashboard/payouts");
  return { id: payout.id, amount: payout.amount };
}
