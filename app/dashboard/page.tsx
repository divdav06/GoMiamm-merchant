import { checkPartnerAccess } from "@/lib/checkPartnerAccess";

// Dashboard home is a thin "welcome" tile for now. Phase E step 4+ will
// fill it with the live orders feed + today's earnings.
export default async function DashboardHome() {
  // Layout already gated on partner access; calling again is the
  // cleanest way to surface the role + name without prop-drilling
  // through the layout.
  const access = await checkPartnerAccess();
  if (!access) return null;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back<span className="text-brand">.</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          You're signed in as <span className="font-medium text-gray-700">{access.role}</span> for{" "}
          <span className="font-medium text-gray-700">{access.storeName}</span>.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile title="Orders" body="Incoming orders, accept / reject, kitchen status." />
        <Tile title="Menu" body="Items, prices, availability, 86 toggles." />
        <Tile title="Hours" body="Open / close times, holiday closures." />
        <Tile title="Payouts" body="Daily / weekly / monthly settlements." />
        <Tile title="Analytics" body="Sales, top items, cancellation rate." />
        <Tile title="Settings" body="Bank account, contact, notifications." />
      </section>
    </div>
  );
}

function Tile({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">{title}</div>
      <div className="text-sm text-gray-600 leading-snug">{body}</div>
      <div className="mt-4 inline-flex items-center text-xs font-medium text-gray-400">
        Coming soon
      </div>
    </div>
  );
}
