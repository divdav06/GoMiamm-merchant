import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BankingStep } from "@/components/onboarding/BankingStep";
import { BusinessInfoStep, type BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import { ContractStep } from "@/components/onboarding/ContractStep";
import { OperationsStep, type OperationsInfo } from "@/components/onboarding/OperationsStep";
import { StepIndicator, type OnboardingStatus } from "@/components/StepIndicator";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { getOnboardingCopy, pickLocale } from "@/lib/onboardingCopy";
import { createAdminSupabase } from "@/lib/supabaseAdmin";
import { createServerSupabase } from "@/lib/supabase";

import {
  completeBanking,
  refreshBankingStatus,
  saveBusinessInfo,
  saveOperationsInfo,
  signContract,
  startBankingOnboarding,
} from "./actions";

// Phase F.3–F.6 — all four step forms wired end-to-end. status mapping:
//   {not_started, business_info} → BusinessInfoStep (prefilled)
//   operations                   → OperationsStep   (prefilled)
//   banking                      → BankingStep      (Stripe handoff)
//   contract_pending             → ContractStep     (signature canvas)
// status === 'completed' bounces to /dashboard (reverse of the layout's
// redirect-on-incomplete guard) — signContract revalidates this path
// and the next render hits the redirect branch.
export default async function OnboardingPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const admin = createAdminSupabase();
  const [storeRes, signupRes, payoutRes] = await Promise.all([
    supabase
      .from("stores")
      .select("onboarding_status, preferred_language")
      .eq("id", access.storeId)
      .maybeSingle(),
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
  const locale = pickLocale(storeRes.data?.preferred_language as string | null | undefined);
  const copy = getOnboardingCopy(locale);

  const businessInfo = (signupRes.data?.business_info as Partial<BusinessInfo> | null) ?? undefined;
  const operationsInfo = (signupRes.data?.operations_info as Partial<OperationsInfo> | null) ?? undefined;
  const payoutsEnabled = !!payoutRes.data?.payouts_enabled;
  const onBusinessStep = status === "not_started" || status === "business_info";
  const onOperationsStep = status === "operations";
  const onBankingStep = status === "banking";
  const onContractStep = status === "contract_pending";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{copy.page.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{access.storeName}</p>
      </header>

      <StepIndicator status={status} copy={copy.steps} />

      {onBusinessStep ? (
        <BusinessInfoStep
          initial={businessInfo}
          onSubmit={saveBusinessInfo}
          copy={copy.business}
          common={copy.common}
        />
      ) : onOperationsStep ? (
        <OperationsStep
          initial={operationsInfo}
          onSubmit={saveOperationsInfo}
          copy={copy.operations}
          common={copy.common}
        />
      ) : onBankingStep ? (
        <BankingStep
          payoutsEnabled={payoutsEnabled}
          onConnect={startBankingOnboarding}
          onRefresh={refreshBankingStatus}
          onContinue={completeBanking}
          copy={copy.banking}
          common={copy.common}
        />
      ) : onContractStep ? (
        <ContractStep
          summary={{
            legal_name: businessInfo?.legal_name ?? access.storeName,
            dba: businessInfo?.dba ?? "",
            address: businessInfo?.address ?? "",
            phone: businessInfo?.phone ?? "",
            tax_id: businessInfo?.tax_id ?? "",
            cuisine_type: operationsInfo?.cuisine_type ?? "",
            email: access.email ?? "",
          }}
          onSubmit={signContract}
          copy={copy.contract}
        />
      ) : null}
    </div>
  );
}
