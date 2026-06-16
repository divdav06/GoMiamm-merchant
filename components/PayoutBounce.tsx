"use client";

import { useEffect } from "react";

// Stripe Connect onboarding bounce page. Stripe's hosted onboarding can
// only redirect to an https:// URL, never a custom app scheme — so it
// returns the driver here and we immediately hand control back to the
// driver-app via its driverapp:// scheme. iOS Safari View Controller and
// Android Chrome Custom Tabs both intercept driverapp:// and reopen the
// app; the payout screen's useFocusEffect then re-reads
// driver_payout_accounts so the UI reflects Stripe's webhook state.
//
// Hosted on partner.gomiamm.com (this merchant portal) so the legacy
// gomiamm.com GitHub Pages origin can be retired. The content is
// driver-facing despite the merchant domain — this is purely a redirect.
export default function PayoutBounce({
  scheme,
  title,
  description,
}: {
  scheme: string;
  title: string;
  description: string;
}) {
  useEffect(() => {
    window.location.href = scheme;
  }, [scheme]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-gray-50">
      <div className="w-full max-w-md text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand"
        />
        <h1 className="text-xl font-extrabold text-gray-900 mb-3">{title}</h1>
        <p className="text-[15px] leading-relaxed text-gray-500 mb-6">{description}</p>
        <a
          href={scheme}
          className="inline-block rounded-lg bg-brand px-6 py-3.5 text-[15px] font-extrabold text-white active:opacity-85"
        >
          Open GoMiamm Driver
        </a>
      </div>
    </main>
  );
}
