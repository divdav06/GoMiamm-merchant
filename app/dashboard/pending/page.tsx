import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { getOnboardingCopy, pickLocale } from "@/lib/onboardingCopy";
import { createServerSupabase } from "@/lib/supabase";

// Phase F.8 — "under review" landing for merchants whose onboarding is
// complete but whose stores.is_approved is still false. The layout is
// the actual gate (redirects here on completed + !approved, and
// redirects away on completed + approved); this page doesn't enforce
// anything itself, it just renders the friendly waiting state.
//
// Layout strips the sidebar/topbar chrome for this route since none of
// it would work anyway — every other dashboard nav target bounces back
// here until approval lands.
export default async function PendingApprovalPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const { data: store } = await supabase
    .from("stores")
    .select("preferred_language, contract_signed_at")
    .eq("id", access.storeId)
    .maybeSingle();

  const locale = pickLocale(store?.preferred_language as string | null | undefined);
  const copy = getOnboardingCopy(locale).pending;

  const signedDate = store?.contract_signed_at
    ? new Date(store.contract_signed_at as string).toLocaleDateString(
        locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : null;

  return (
    <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{copy.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{access.storeName}</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{copy.subtitle}</p>

      <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          {copy.timeline_heading}
        </div>
        <ul className="space-y-2.5 text-sm">
          <TimelineRow done label={copy.timeline_signed} hint={signedDate ?? undefined} />
          <TimelineRow done label={copy.timeline_payouts} />
          <TimelineRow current label={copy.timeline_review} />
        </ul>
      </section>

      <div className="rounded-lg bg-brand/5 border border-brand/20 px-4 py-3 text-sm text-gray-700">
        {copy.email_notice(access.email ?? "")}
      </div>

      <p className="text-xs text-gray-400">{copy.timing}</p>

      <div className="pt-2 border-t border-gray-100">
        <a
          href="/api/sign-out"
          className="text-xs font-semibold text-gray-500 hover:text-gray-900"
        >
          {copy.sign_out}
        </a>
      </div>
    </div>
  );
}

function TimelineRow({
  done,
  current,
  label,
  hint,
}: {
  done?: boolean;
  current?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <span aria-hidden="true" className="mt-0.5 inline-flex w-4 h-4 rounded-full bg-emerald-500 text-white items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
      ) : current ? (
        <span aria-hidden="true" className="mt-0.5 inline-block w-4 h-4 rounded-full border-2 border-amber-500 shrink-0">
          <span className="block w-full h-full rounded-full bg-amber-500/30 animate-pulse" />
        </span>
      ) : (
        <span aria-hidden="true" className="mt-0.5 inline-block w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
      )}
      <div className="flex-1">
        <div className={done ? "text-gray-900" : current ? "text-amber-700 font-medium" : "text-gray-500"}>
          {label}
        </div>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
    </li>
  );
}
