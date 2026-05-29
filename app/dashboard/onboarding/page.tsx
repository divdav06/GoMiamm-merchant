import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BusinessInfoStep, type BusinessInfo } from "@/components/onboarding/BusinessInfoStep";
import { StepIndicator, type OnboardingStatus } from "@/components/StepIndicator";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { saveBusinessInfo } from "./actions";

// Phase F.3 — first form lands. status ∈ {not_started, business_info}
// renders BusinessInfoStep with any draft prefilled from
// restaurant_signups.business_info. status === 'completed' bounces to
// /dashboard (reverse of the layout's redirect-on-incomplete guard).
// Other intermediate statuses keep a placeholder until their step
// component lands in F.4+.
export default async function OnboardingPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const [storeRes, signupRes] = await Promise.all([
    supabase.from("stores").select("onboarding_status").eq("id", access.storeId).maybeSingle(),
    supabase.from("restaurant_signups").select("business_info").eq("store_id", access.storeId).maybeSingle(),
  ]);
  const status = ((storeRes.data?.onboarding_status as string | undefined) ?? "not_started") as OnboardingStatus;
  if (status === "completed") {
    redirect("/dashboard");
  }

  const businessInfo = (signupRes.data?.business_info as Partial<BusinessInfo> | null) ?? undefined;
  const onBusinessStep = status === "not_started" || status === "business_info";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-gray-500 text-sm mt-1">{access.storeName}</p>
      </header>

      <StepIndicator status={status} />

      {onBusinessStep ? (
        <BusinessInfoStep initial={businessInfo} onSubmit={saveBusinessInfo} />
      ) : (
        <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <div className="text-sm font-medium text-gray-700">Step F.4 à venir</div>
          <p className="text-xs text-gray-500 mt-1">
            Operations / Banking / Contract lands as soon as their step components ship.
          </p>
        </section>
      )}
    </div>
  );
}
