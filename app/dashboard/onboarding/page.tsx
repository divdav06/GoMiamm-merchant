import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BusinessInfoStep, type BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import { OperationsStep, type OperationsInfo } from "@/components/onboarding/OperationsStep";
import { StepIndicator, type OnboardingStatus } from "@/components/StepIndicator";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { saveBusinessInfo, saveOperationsInfo } from "./actions";

// Phase F.3/F.4 — first two forms land. status ∈ {not_started,
// business_info} renders BusinessInfoStep; status === 'operations'
// renders OperationsStep. Both prefill from restaurant_signups jsonb
// columns if a previous draft exists. status === 'completed' bounces to
// /dashboard (reverse of the layout's redirect-on-incomplete guard).
// Remaining statuses keep a placeholder until F.5+.
export default async function OnboardingPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const [storeRes, signupRes] = await Promise.all([
    supabase.from("stores").select("onboarding_status").eq("id", access.storeId).maybeSingle(),
    supabase
      .from("restaurant_signups")
      .select("business_info, operations_info")
      .eq("store_id", access.storeId)
      .maybeSingle(),
  ]);
  const status = ((storeRes.data?.onboarding_status as string | undefined) ?? "not_started") as OnboardingStatus;
  if (status === "completed") {
    redirect("/dashboard");
  }

  const businessInfo = (signupRes.data?.business_info as Partial<BusinessInfo> | null) ?? undefined;
  const operationsInfo = (signupRes.data?.operations_info as Partial<OperationsInfo> | null) ?? undefined;
  const onBusinessStep = status === "not_started" || status === "business_info";
  const onOperationsStep = status === "operations";

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
      ) : (
        <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <div className="text-sm font-medium text-gray-700">Step F.5 à venir</div>
          <p className="text-xs text-gray-500 mt-1">
            Banking / Contract lands as soon as their step components ship.
          </p>
        </section>
      )}
    </div>
  );
}
