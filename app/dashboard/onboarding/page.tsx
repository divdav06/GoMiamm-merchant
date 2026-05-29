import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { StepIndicator, type OnboardingStatus } from "@/components/StepIndicator";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

// Phase F.2 — onboarding shell. The dashboard layout already redirects
// every non-onboarding route here when stores.onboarding_status is
// anything other than 'completed'. Here we handle the reverse: an
// already-completed merchant who navigates back to /dashboard/onboarding
// gets bounced to /dashboard so the funnel can't accidentally re-run.
// Phase F.3+ will replace the placeholder body with the actual
// per-step forms.
export default async function OnboardingPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const { data: store } = await supabase
    .from("stores")
    .select("onboarding_status")
    .eq("id", access.storeId)
    .maybeSingle();
  const status = ((store?.onboarding_status as string | undefined) ?? "not_started") as OnboardingStatus;
  if (status === "completed") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-gray-500 text-sm mt-1">{access.storeName}</p>
      </header>

      <StepIndicator status={status} />

      <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
        <div className="text-sm font-medium text-gray-700">Step F.3 à venir</div>
        <p className="text-xs text-gray-500 mt-1">
          Le formulaire Business / Operations / Banking / Contract arrive au prochain step.
        </p>
      </section>
    </div>
  );
}
