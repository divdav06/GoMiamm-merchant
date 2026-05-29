import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BankingStep } from "@/components/onboarding/BankingStep";
import { BusinessInfoStep, type BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import { OperationsStep, type OperationsInfo } from "@/components/onboarding/OperationsStep";
import { StepIndicator, type OnboardingStatus } from "@/components/StepIndicator";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";
import { createServerSupabase } from "@/lib/supabase";

import {
  completeBanking,
  refreshBankingStatus,
  saveBusinessInfo,
  saveOperationsInfo,
  startBankingOnboarding,
} from "./actions";

// Phase F.3/F.4/F.5 — first three step forms land. status mapping:
//   {not_started, business_info} → BusinessInfoStep (prefilled)
//   operations                   → OperationsStep   (prefilled)
//   banking                      → BankingStep      (Stripe handoff)
// status === 'completed' bounces to /dashboard (reverse of the layout's
// redirect-on-incomplete guard). contract_pending keeps the placeholder
// until F.6 lands.
export default async function OnboardingPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const admin = createAdminSupabase();
  const [storeRes, signupRes, payoutRes] = await Promise.all([
    supabase.from("stores").select("onboarding_status").eq("id", access.storeId).maybeSingle(),
    supabase
      .from("restaurant_signups")
      .select("business_info, operations_info")
      .eq("store_id", access.storeId)
      .maybeSingle(),
    admin
      .from("restaurants_payout_accounts")
      .select("payouts_enabled")
      .eq("store_id", access.storeId)
      .maybeSingle(),
  ]);
  const status = ((storeRes.data?.onboarding_status as string | undefined) ?? "not_started") as OnboardingStatus;
  if (status === "completed") {
    redirect("/dashboard");
  }

  const businessInfo = (signupRes.data?.business_info as Partial<BusinessInfo> | null) ?? undefined;
  const operationsInfo = (signupRes.data?.operations_info as Partial<OperationsInfo> | null) ?? undefined;
  const payoutsEnabled = !!payoutRes.data?.payouts_enabled;
  const onBusinessStep = status === "not_started" || status === "business_info";
  const onOperationsStep = status === "operations";
  const onBankingStep = status === "banking";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-gray-500 text-sm mt-1">{access.storeName}</p>
      </header>

      <StepIndicator status={status} />

      {onBusinessStep ? (
        <BusinessInfoStep initial={businessInfo} onSubmit={saveBusinessInfo} />
      ) : onOperationsStep ? (
        <OperationsStep initial={operationsInfo} onSubmit={saveOperationsInfo} />
      ) : onBankingStep ? (
        <BankingStep
          payoutsEnabled={payoutsEnabled}
          onConnect={startBankingOnboarding}
          onRefresh={refreshBankingStatus}
          onContinue={completeBanking}
        />
      ) : (
        <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <div className="text-sm font-medium text-gray-700">Step F.6 à venir</div>
          <p className="text-xs text-gray-500 mt-1">
            Contract signature lands as soon as its step component ships.
          </p>
        </section>
      )}
    </div>
  );
}
