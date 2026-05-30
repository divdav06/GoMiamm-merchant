import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import {
  getConnectedBalance,
  listConnectedPayouts,
  type StripeBalance,
  type StripePayout,
} from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

import { PayoutDashboard } from "./PayoutDashboard";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type AccountRow = {
  stripe_account_id: string | null;
  payouts_enabled: boolean | null;
  charges_enabled: boolean | null;
  requirements_due: string[] | null;
};

export default async function PayoutsPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  // Account row via service-role — the RLS path also works but we want
  // the same client everywhere on this page for consistency.
  const admin = createAdminSupabase();
  const { data: accountRow } = await admin
    .from("restaurants_payout_accounts")
    .select("stripe_account_id, payouts_enabled, charges_enabled, requirements_due")
    .eq("store_id", access.storeId)
    .maybeSingle();
  const account = (accountRow as AccountRow | null) ?? null;

  // Stripe balance + payout history only when an account exists. If
  // Stripe is unreachable / unconfigured we degrade gracefully and let
  // the UI render the onboarding CTA without a 500.
  let balance: StripeBalance | null = null;
  let payouts: StripePayout[] = [];
  let stripeError: string | null = null;
  if (account?.stripe_account_id) {
    try {
      balance = await getConnectedBalance(account.stripe_account_id);
    } catch (err) {
      stripeError = err instanceof Error ? err.message : String(err);
    }
    try {
      const list = await listConnectedPayouts(account.stripe_account_id, 20);
      payouts = list.data;
    } catch {
      /* keep going — empty payouts list */
    }
  }

  // Earnings rollups — gross subtotal of delivered orders for the
  // store, bucketed today / 7-day / 30-day. Restaurant's net is
  // computed in the client via stores.commission_rate.
  //
  // commission_rate is read-only at the database layer (column-level
  // GRANT SELECT but not UPDATE for authenticated; UPDATE only
  // exists via service-role through the contract signing path).
  // No edit control is rendered for it anywhere in the merchant
  // surfaces — display-only.
  const supabase = createServerSupabase(cookies());
  const since30d = new Date(Date.now() - 30 * ONE_DAY_MS).toISOString();
  const { data: deliveredOrders } = await supabase
    .from("orders")
    .select("subtotal, delivered_at")
    .eq("store_id", access.storeId)
    .eq("status", "delivered")
    .gte("delivered_at", since30d);

  const { data: storeMeta } = await supabase
    .from("stores")
    .select("commission_rate")
    .eq("id", access.storeId)
    .maybeSingle();
  const commissionPct = Number(storeMeta?.commission_rate ?? 15);

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const weekStartMs = now - 7 * ONE_DAY_MS;

  let todayGross = 0, todayCount = 0;
  let weekGross = 0, weekCount = 0;
  let monthGross = 0, monthCount = 0;
  for (const row of deliveredOrders ?? []) {
    const subtotal = Number(row.subtotal ?? 0);
    const at = row.delivered_at ? new Date(row.delivered_at).getTime() : 0;
    monthGross += subtotal; monthCount += 1;
    if (at >= weekStartMs) { weekGross += subtotal; weekCount += 1; }
    if (at >= todayStartMs) { todayGross += subtotal; todayCount += 1; }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · Stripe Connect Express. Earnings shown gross; commission of {commissionPct}% deducted at payout.
        </p>
      </header>

      <PayoutDashboard
        hasAccount={!!account?.stripe_account_id}
        payoutsEnabled={!!account?.payouts_enabled}
        chargesEnabled={!!account?.charges_enabled}
        requirementsDue={account?.requirements_due ?? []}
        balance={balance}
        payouts={payouts}
        stripeError={stripeError}
        earnings={{
          commissionPct,
          today: { gross: todayGross, count: todayCount },
          week:  { gross: weekGross,  count: weekCount },
          month: { gross: monthGross, count: monthCount },
        }}
      />
    </div>
  );
}
