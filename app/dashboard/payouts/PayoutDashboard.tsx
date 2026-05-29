"use client";

import { useState, useTransition } from "react";

import type { StripeBalance, StripePayout } from "@/lib/stripe";

import { checkAccountStatus, createConnectAccount, requestManualPayout } from "./actions";

type EarningsBucket = { gross: number; count: number };

type Props = {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requirementsDue: string[];
  balance: StripeBalance | null;
  payouts: StripePayout[];
  stripeError: string | null;
  earnings: {
    commissionPct: number;
    today: EarningsBucket;
    week: EarningsBucket;
    month: EarningsBucket;
  };
};

function dollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

function centsToDollars(cents: number): number {
  return cents / 100;
}

function netOf(gross: number, commissionPct: number): number {
  return gross * (1 - commissionPct / 100);
}

function formatDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PAYOUT_STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  in_transit: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  canceled: "bg-gray-100 text-gray-700",
};

export function PayoutDashboard(props: Props) {
  const { hasAccount, payoutsEnabled, chargesEnabled, requirementsDue, balance, payouts, stripeError, earnings } = props;
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function onConnect() {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        const { url } = await createConnectAccount();
        window.location.href = url; // hand off to Stripe-hosted onboarding
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onRefreshStatus() {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        await checkAccountStatus();
        setToast("Status refreshed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onPayout() {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        const result = await requestManualPayout();
        setToast(`Payout sent · ${dollars(centsToDollars(result.amount))}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  // Pull a single available/pending USD amount for now. Multi-currency
  // markets are out-of-scope for phase E step 7.
  const availableUsd = balance?.available.find((a) => a.currency.toLowerCase() === "usd")?.amount ?? 0;
  const pendingUsd = balance?.pending.find((a) => a.currency.toLowerCase() === "usd")?.amount ?? 0;
  // Stripe doesn't surface "next payout date" on /balance — fall back
  // to the soonest-arrival pending row in the payout list.
  const nextScheduled = payouts.find((p) => p.status === "pending" || p.status === "in_transit");

  return (
    <div className="space-y-6">
      {(error || stripeError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? stripeError}
        </div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {toast}
        </div>
      )}

      {/* Connect onboarding state */}
      {!hasAccount && (
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900">Set up payouts</h2>
          <p className="text-sm text-gray-600 mt-1">
            Connect a Stripe Express account to receive automatic weekly payouts
            (or pay out manually whenever you want). Takes about 3 minutes.
          </p>
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Opening Stripe…" : "Set up payouts"}
          </button>
        </section>
      )}

      {hasAccount && (!payoutsEnabled || !chargesEnabled) && (
        <section className="bg-white border border-amber-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-amber-900">Finish Stripe verification</h2>
          <p className="text-sm text-amber-800 mt-1">
            Stripe still needs some info before payouts can run.
            {requirementsDue.length > 0 && (
              <> Outstanding: <code className="text-xs bg-amber-100 rounded px-1">{requirementsDue.slice(0, 4).join(", ")}</code>
              {requirementsDue.length > 4 ? ` +${requirementsDue.length - 4} more` : ""}.</>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConnect}
              disabled={busy}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Opening Stripe…" : "Continue setup"}
            </button>
            <button
              type="button"
              onClick={onRefreshStatus}
              disabled={busy}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-amber-200 text-amber-800 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50"
            >
              Refresh status
            </button>
          </div>
        </section>
      )}

      {hasAccount && payoutsEnabled && (
        <>
          {/* Balances + next payout */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BalanceTile
              label="Available"
              valueCents={availableUsd}
              hint="Ready to pay out"
              accent
            />
            <BalanceTile
              label="Pending"
              valueCents={pendingUsd}
              hint="Clears 2–3 business days after each delivered order"
            />
            <NextPayoutTile payout={nextScheduled} />
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPayout}
              disabled={busy || availableUsd <= 0}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Sending payout…" : "Pay out available balance"}
            </button>
            <button
              type="button"
              onClick={onRefreshStatus}
              disabled={busy}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh balance
            </button>
          </div>

          {/* Past payouts */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Payout history
              </h2>
            </div>
            {payouts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">
                No payouts yet. Once Stripe runs the first one it'll show up here.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {dollars(centsToDollars(p.amount))} {p.currency.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Arrives {formatDate(p.arrival_date)} · initiated {formatDate(p.created)}
                      </div>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide",
                        PAYOUT_STATUS_TONE[p.status] ?? "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Earnings tiles — always visible (they read from orders, not Stripe) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <EarningsTile label="Today" bucket={earnings.today} commissionPct={earnings.commissionPct} />
        <EarningsTile label="Last 7 days" bucket={earnings.week} commissionPct={earnings.commissionPct} />
        <EarningsTile label="Last 30 days" bucket={earnings.month} commissionPct={earnings.commissionPct} />
      </section>
    </div>
  );
}

function BalanceTile({
  label,
  valueCents,
  hint,
  accent,
}: {
  label: string;
  valueCents: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl shadow-sm p-5 border ${accent ? "bg-brand text-white border-brand" : "bg-white text-gray-900 border-gray-200"}`}>
      <div className={`text-xs uppercase tracking-wide font-semibold ${accent ? "opacity-80" : "text-gray-400"}`}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{dollars(centsToDollars(valueCents))}</div>
      <div className={`text-xs mt-1 ${accent ? "opacity-80" : "text-gray-500"}`}>{hint}</div>
    </div>
  );
}

function NextPayoutTile({ payout }: { payout: StripePayout | undefined }) {
  return (
    <div className="rounded-2xl shadow-sm p-5 border bg-white border-gray-200">
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-400">
        Next payout
      </div>
      {payout ? (
        <>
          <div className="text-2xl font-bold mt-1 text-gray-900">
            {formatDate(payout.arrival_date)}
          </div>
          <div className="text-xs mt-1 text-gray-500">
            {dollars(centsToDollars(payout.amount))} · {payout.status.replace(/_/g, " ")}
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold mt-1 text-gray-900">—</div>
          <div className="text-xs mt-1 text-gray-500">No payout currently in transit.</div>
        </>
      )}
    </div>
  );
}

function EarningsTile({
  label,
  bucket,
  commissionPct,
}: {
  label: string;
  bucket: EarningsBucket;
  commissionPct: number;
}) {
  return (
    <div className="rounded-2xl shadow-sm p-5 border bg-white border-gray-200">
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-400">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-gray-900">
        {dollars(netOf(bucket.gross, commissionPct))}
      </div>
      <div className="text-xs mt-1 text-gray-500">
        {bucket.count} order{bucket.count === 1 ? "" : "s"} · {dollars(bucket.gross)} gross
      </div>
    </div>
  );
}
