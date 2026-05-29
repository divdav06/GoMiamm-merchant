"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { OnboardingCopy } from "@/lib/onboardingCopy";

// Phase F.5 — Banking step. Hands the merchant off to Stripe Connect
// Express onboarding to add a bank account / debit card for payouts.
//
// The actual Stripe wiring (account creation + onboarding-link mint +
// status sync) already lives in phase E.7's createConnectAccount /
// checkAccountStatus actions under app/dashboard/payouts/actions.ts —
// we reuse them via thin wrappers in onboarding/actions.ts that route
// the return URL back to /dashboard/onboarding rather than
// /dashboard/payouts. No Stripe REST calls are duplicated here.
//
// Two display states:
//   - Pre-connect (payoutsEnabled=false): "Set up payouts with Stripe"
//     button. window.location → Stripe-hosted onboarding.
//   - Connected (payoutsEnabled=true):    green "Connected" pill + a
//     Continue button that advances onboarding to contract_pending.
//
// On `?stripe=return` (the URL Stripe redirects to after onboarding),
// we auto-call refreshBankingStatus once and router.refresh() to pick
// up the new payouts_enabled value on the server side.

type RefreshResult = {
  payouts_enabled: boolean;
  charges_enabled: boolean;
  requirements_due: string[];
} | null;

type Props = {
  payoutsEnabled: boolean;
  onConnect: () => Promise<{ url: string }>;
  onRefresh: () => Promise<RefreshResult>;
  onContinue: () => Promise<void>;
  copy: OnboardingCopy["banking"];
  common: OnboardingCopy["common"];
};

export function BankingStep({
  payoutsEnabled,
  onConnect,
  onRefresh,
  onContinue,
  copy,
  common,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get("stripe");

  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(stripeParam === "return");
  const autoRefreshed = useRef(false);

  // Stripe just bounced the merchant back to us. Pull the latest
  // account status, then refresh the route so the server component
  // re-fetches restaurants_payout_accounts.payouts_enabled. Run once.
  useEffect(() => {
    if (stripeParam !== "return" || autoRefreshed.current) return;
    autoRefreshed.current = true;
    let cancelled = false;
    (async () => {
      try {
        await onRefresh();
        if (!cancelled) router.refresh();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setAutoRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stripeParam, onRefresh, router]);

  function onConnectClick() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await onConnect();
        window.location.href = url;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onContinueClick() {
    setError(null);
    startTransition(async () => {
      try {
        await onContinue();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
        </div>
        {payoutsEnabled && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {copy.connected_badge}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {autoRefreshing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {copy.auto_refreshing}
        </div>
      )}

      <ul className="space-y-2 text-sm text-gray-600">
        {copy.bullets.map((b, i) => (
          <Bullet key={i}>{b}</Bullet>
        ))}
      </ul>

      {!payoutsEnabled && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-500 leading-relaxed">
          {copy.privacy}
        </div>
      )}

      <div className="flex items-center justify-end pt-1">
        {payoutsEnabled ? (
          <button
            type="button"
            onClick={onContinueClick}
            disabled={busy}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? common.saving : common.continue}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnectClick}
            disabled={busy || autoRefreshing}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? copy.busy_opening : copy.cta_connect}
          </button>
        )}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
      <span>{children}</span>
    </li>
  );
}
