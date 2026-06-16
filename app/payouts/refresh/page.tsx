import type { Metadata } from "next";

import PayoutBounce from "@/components/PayoutBounce";

export const metadata: Metadata = {
  title: "GoMiamm Driver — Payouts",
  robots: { index: false, follow: false },
};

// Stripe redirects here when the onboarding link expired or the user
// re-entered (refresh_url in get-stripe-onboarding-link). Bounces to
// driverapp://, where the payout screen requests a fresh account_link.
export default function PayoutRefreshPage() {
  return (
    <PayoutBounce
      scheme="driverapp://payouts/refresh"
      title="Reopening GoMiamm Driver…"
      description="Your Stripe onboarding link expired. If the app doesn't reopen automatically, tap the button below and start the setup again."
    />
  );
}
