// Thin Stripe REST wrapper. We don't pull in the stripe-node SDK
// because the merchant portal targets Cloudflare Pages (workerd
// runtime) and a plain fetch + form-urlencoded body works there
// without the SDK's Node-only deps. Same pattern the GoMiamm-app edge
// functions use (supabase/functions/_shared/stripe.ts).

const STRIPE_API = "https://api.stripe.com/v1";

// Region routing for the two GoMiamm Stripe platforms (mirrors the edge
// helper supabase/functions/_shared/stripe.ts):
//   'FR'                    → FR SASU account
//   'US' | 'CA' | null | ?  → US LLC account (CA rides the US LLC)
// Also accepts an already-resolved region string ('US'/'FR'); anything
// that isn't 'FR' (case/space-insensitive) maps to 'US'.
export type StripeRegion = "US" | "FR";

export function regionForCountry(cc?: string | null): StripeRegion {
  return (cc ?? "").trim().toUpperCase() === "FR" ? "FR" : "US";
}

// US falls back to the legacy STRIPE_SECRET_KEY so that, until
// STRIPE_SECRET_KEY_US / STRIPE_SECRET_KEY_FR are set, every call keeps
// hitting the existing US account exactly as before. FR has no fallback.
function resolveStripeKey(ccOrRegion?: string | null): string {
  const region = regionForCountry(ccOrRegion);
  const k = region === "FR"
    ? process.env.STRIPE_SECRET_KEY_FR
    : (process.env.STRIPE_SECRET_KEY_US ?? process.env.STRIPE_SECRET_KEY);
  if (!k) throw new Error(`stripe_key_unconfigured_${region}`);
  return k;
}

type StripeError = { error?: { message?: string; code?: string; type?: string } };

async function call<T = unknown>(
  path: string,
  init: { method?: string; body?: URLSearchParams; query?: Record<string, string | number | undefined>; stripeAccount?: string; idempotencyKey?: string; countryCode?: string | null } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolveStripeKey(init.countryCode)}`,
  };
  if (init.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (init.stripeAccount) headers["Stripe-Account"] = init.stripeAccount;
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  let url = `${STRIPE_API}${path}`;
  if (init.query && Object.keys(init.query).length > 0) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) q.append(k, String(v));
    }
    url += `?${q.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: init.body?.toString(),
  });
  const text = await res.text();
  let parsed: T | StripeError = {} as T;
  try { parsed = text ? JSON.parse(text) : ({} as T); } catch { /* ignore */ }
  if (!res.ok) {
    const errMsg = (parsed as StripeError).error?.message ?? `Stripe ${res.status}`;
    throw new Error(errMsg);
  }
  return parsed as T;
}

// ── Refunds ────────────────────────────────────────────────────────

// Refund a captured PaymentIntent in full. Used when a restaurant rejects
// an order the customer already paid for (payments capture immediately, so
// a reject after payment must refund). The idempotency key keeps a double
// reject from issuing two refunds. stripe-webhook's charge.refunded handler
// then flips orders.payment_status='refunded' and records the refunds row.
export async function refundPaymentIntent(paymentIntentId: string, idempotencyKey: string): Promise<void> {
  const body = new URLSearchParams();
  body.set("payment_intent", paymentIntentId);
  await call("/refunds", { method: "POST", body, idempotencyKey });
}

// ── Connect Accounts ───────────────────────────────────────────────

export type StripeAccount = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements?: { currently_due?: string[]; past_due?: string[] };
  settings?: { payouts?: { schedule?: { interval?: string; weekly_anchor?: string; monthly_anchor?: number } } };
};

// countryCode (Stripe US/FR routing #3) sets the Express account's
// country AND, via call(), which platform key creates it: FR -> SASU,
// US/CA -> US LLC (Stripe supports a CA account on the US platform).
// Defaults to "US" so any legacy caller stays byte-identical.
// business_type stays "company" — restaurants are legal entities.
export async function createExpressAccount(
  metadata: Record<string, string>,
  countryCode = "US",
): Promise<StripeAccount> {
  const form = new URLSearchParams();
  form.set("type", "express");
  form.set("country", countryCode);
  form.set("business_type", "company");
  form.set("capabilities[transfers][requested]", "true");
  form.set("capabilities[card_payments][requested]", "true");
  for (const [k, v] of Object.entries(metadata)) {
    form.set(`metadata[${k}]`, v);
  }
  return call<StripeAccount>("/accounts", { method: "POST", body: form, countryCode });
}

export async function getAccount(accountId: string, countryCode = "US"): Promise<StripeAccount> {
  return call<StripeAccount>(`/accounts/${accountId}`, { countryCode });
}

export async function createAccountOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
  countryCode = "US",
): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set("account", accountId);
  form.set("refresh_url", refreshUrl);
  form.set("return_url", returnUrl);
  form.set("type", "account_onboarding");
  // Link must be minted on the platform that owns the acct_ (#3).
  return call<{ url: string }>("/account_links", { method: "POST", body: form, countryCode });
}

// ── Balances + Payouts (per connected account, via Stripe-Account hdr) ──

type StripeBalanceAmount = { amount: number; currency: string };
export type StripeBalance = {
  available: StripeBalanceAmount[];
  pending: StripeBalanceAmount[];
};

// countryCode (Stripe US/FR routing #6) selects the platform key; the
// connected account is still targeted via the Stripe-Account header.
// Defaults to "US" so existing US rows are byte-identical.
export async function getConnectedBalance(accountId: string, countryCode = "US"): Promise<StripeBalance> {
  return call<StripeBalance>("/balance", { stripeAccount: accountId, countryCode });
}

export type StripePayout = {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number; // unix
  created: number;
  status: string;
  description: string | null;
};

export async function listConnectedPayouts(
  accountId: string,
  limit = 20,
  countryCode = "US",
): Promise<{ data: StripePayout[] }> {
  return call<{ data: StripePayout[] }>("/payouts", {
    stripeAccount: accountId,
    query: { limit },
    countryCode,
  });
}

// MONEY PATH — the manual restaurant payout. countryCode (Stripe US/FR
// routing #6) routes the payout through the platform that owns the
// connected account, so an FR store's payout originates from the SASU
// platform, not US. The connected acct is still targeted via the
// Stripe-Account header; countryCode only picks the secret key.
export async function createConnectedPayout(
  accountId: string,
  amount: number,
  currency: string,
  countryCode = "US",
): Promise<StripePayout> {
  const form = new URLSearchParams();
  form.set("amount", String(amount));
  form.set("currency", currency);
  return call<StripePayout>("/payouts", {
    method: "POST",
    body: form,
    stripeAccount: accountId,
    countryCode,
  });
}
