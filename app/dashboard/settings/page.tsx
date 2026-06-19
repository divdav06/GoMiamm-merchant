import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { LanguagePicker } from "./LanguagePicker";
import { ProfileForm } from "./ProfileForm";

type DaySchedule = { is_open?: boolean; open?: string; close?: string };
type WeeklyHours = Record<string, DaySchedule | undefined>;

const DAY_ORDER: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default async function SettingsPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const { data: store } = await supabase
    .from("stores")
    .select(
      "name, description, address, phone, category, cuisine, website_url, preferred_language, contract_pdf_url, owner_email, is_open_now, hours_json",
    )
    .eq("id", access.storeId)
    .maybeSingle();

  const hours = ((store?.hours_json ?? null) as WeeklyHours | null) ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · manage your store profile. Bank + notification
          preferences coming soon.
        </p>
      </header>

      {/* Store profile — editable, parity with native app Settings tab */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Store profile
        </h2>
        <ProfileForm
          profile={{
            name: store?.name ?? access.storeName,
            description: store?.description ?? null,
            address: store?.address ?? "",
            phone: store?.phone ?? null,
            category: store?.category ?? null,
            cuisine: store?.cuisine ?? null,
            website_url: store?.website_url ?? null,
          }}
        />
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <Row label="Contact email" value={store?.owner_email ?? access.email ?? "—"} />
          <Row
            label="Currently"
            value={
              <span className={[
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                store?.is_open_now ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700",
              ].join(" ")}>
                {store?.is_open_now ? "Open" : "Closed"}
              </span>
            }
          />
        </div>
      </section>

      {/* Language — parity with native app Settings tab */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Language
        </h2>
        <LanguagePicker current={store?.preferred_language ?? null} />
      </section>

      {/* Weekly hours summary */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Weekly hours
          </h2>
          <a
            href="/dashboard/hours"
            className="text-xs font-semibold text-brand hover:text-brand-600"
          >
            Edit →
          </a>
        </div>
        {!hours ? (
          <p className="text-sm text-gray-500">
            No schedule set yet. <a href="/dashboard/hours" className="text-brand hover:underline">Set your hours</a>.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {DAY_ORDER.map((d) => {
              const day = hours[d.key];
              const isOpen = !!day?.is_open;
              return (
                <li key={d.key} className="py-2 flex items-center justify-between">
                  <span className="text-gray-700 w-28">{d.label}</span>
                  {isOpen && day?.open && day?.close ? (
                    <span className="text-gray-900 font-medium tabular-nums">
                      {day.open} – {day.close}
                    </span>
                  ) : (
                    <span className="text-gray-400">Closed</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Documents — view-only signed contract, parity with app */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Documents
        </h2>
        {store?.contract_pdf_url ? (
          <a
            href={store.contract_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-600"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            View signed contract
          </a>
        ) : (
          <p className="text-sm text-gray-500">
            No signed contract on file yet.
          </p>
        )}
      </section>

      {/* Coming-soon stubs */}
      <section className="bg-white border border-dashed border-gray-300 rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Coming soon
        </h2>
        <ul className="space-y-2 text-sm">
          <ComingSoon title="Bank account & payout settings" body="Edit external bank account or debit card used for payouts. For now, manage via the Payouts page." />
          <ComingSoon title="Notification preferences" body="Email + push toggles for new orders, payouts, and support replies." />
          <ComingSoon title="Tax & business details" body="EIN / tax ID, entity type, address for legal documents." />
          <ComingSoon title="Team members" body="Invite managers and staff to your store." />
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900 break-words">{value}</span>
    </div>
  );
}

function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
      <div>
        <div className="font-medium text-gray-800">{title}</div>
        <div className="text-gray-500">{body}</div>
      </div>
    </li>
  );
}
