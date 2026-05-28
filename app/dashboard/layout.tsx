import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { checkPartnerAccess } from "@/lib/checkPartnerAccess";

// Server component. Runs on every dashboard request and gates entry on
// having an active restaurant_users row. Middleware already keeps
// unauthed visitors out of /dashboard/*, but it doesn't know about the
// merchant role — that check lives here.
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
