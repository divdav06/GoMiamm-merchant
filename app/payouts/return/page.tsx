import type { Metadata } from "next";

import PayoutBounce from "@/components/PayoutBounce";

export const metadata: Metadata = {
  title: "GoMiamm Driver — Payouts",
  robots: { index: false, follow: false },
};

// Stripe redirects here after the driver finishes Connect onboarding
// (return_url in get-stripe-onboarding-link). Bounces to driverapp://.
export default function PayoutReturnPage() {
  return (
    <PayoutBounce
      scheme="driverapp://payouts/return"
      title="Returning to GoMiamm Driver…"
      description="Your Stripe onboarding session is complete. If the app doesn't reopen automatically, tap the button below."
    />
  );
}
