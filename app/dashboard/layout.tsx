import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

// Server component. Runs on every dashboard request and gates entry on
// having an active restaurant_users row. Middleware already keeps
// unauthed visitors out of /dashboard/*, but it doesn't know about the
// merchant role — that check lives here.
//
// Three nested gates run in order:
//
//   1. Auth + partner role (checkPartnerAccess). Failure bounces to
//      /api/sign-out so cookies clear and we don't loop.
//   2. Phase F.2 — onboarding_status !== 'completed' redirects to
//      /dashboard/onboarding (with a startsWith loop guard).
//   3. Phase F.8 — onboarding completed but stores.is_approved still
//      false redirects to /dashboard/pending (awaiting admin review).
//      Inverse guard: when approved, /dashboard/pending bounces to
//      /dashboard so a freshly-approved merchant doesn't get stuck.
//
// The pending route renders without the sidebar/topbar chrome (no
// nav items would work anyway since they'd all bounce back), so we
// branch the layout shell on onPending.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await checkPartnerAccess();
  if (!access) {
    // Bounce through the sign-out route so the user's Supabase cookies
    // get cleared too — otherwise they'd re-enter /dashboard on the
    // next nav, hit this guard again, and bounce in a loop.
    redirect("/api/sign-out?reason=not_partner");
  }

  const supabase = createServerSupabase(cookies());
  const { data: store } = await supabase
    .from("stores")
    .select("onboarding_status, is_approved")
    .eq("id", access.storeId)
    .maybeSingle();
  const onboardingStatus = (store?.onboarding_status as string | undefined) ?? "not_started";
  const isApproved = !!store?.is_approved;

  const pathname = headers().get("x-pathname") ?? "";
  const onOnboarding = pathname.startsWith("/dashboard/onboarding");
  const onPending = pathname.startsWith("/dashboard/pending");

  if (onboardingStatus !== "completed" && !onOnboarding) {
    redirect("/dashboard/onboarding");
  }
  if (onboardingStatus === "completed" && !isApproved && !onPending) {
    redirect("/dashboard/pending");
  }
  if (onboardingStatus === "completed" && isApproved && onPending) {
    redirect("/dashboard");
  }

  if (onPending) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar storeName={access.storeName} email={access.email} />
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
