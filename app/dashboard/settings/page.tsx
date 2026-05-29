import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

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
    .select("name, address, phone, owner_email, is_open_now, hours_json")
    .eq("id", access.storeId)
    .maybeSingle();

  const hours = ((store?.hours_json ?? null) as WeeklyHours | null) ?? null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · review your store profile. Bank + notification
          preferences coming soon.
        </p>
      </header>

      {/* Store profile */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Store profile
        </h2>
        <Row label="Name" value={store?.name ?? access.storeName} />
        <Row label="Address" value={store?.address ?? "—"} />
        <Row label="Phone" value={store?.phone ?? "—"} />
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
