"use client";

import { useState, useTransition } from "react";

import { markReadyForPickup } from "./actions";
import type { ActiveOrder } from "./OrderList";
import { RejectModal } from "./RejectModal";

type Props = { order: ActiveOrder };

const STATUS_LABELS: Record<string, { label: string; tone: "amber" | "blue" | "violet" | "green" }> = {
  pending: { label: "Awaiting payment", tone: "amber" },
  preparing: { label: "Preparing", tone: "violet" },
  ready_for_pickup: { label: "Ready for pickup", tone: "green" },
  rejected: { label: "Rejected", tone: "amber" },
};

function shortId(order: ActiveOrder): string {
  if (order.order_number) return order.order_number;
  return order.id.slice(0, 8).toUpperCase();
}

function dollars(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function relativeTime(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function OrderCard({ order }: Props) {
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = STATUS_LABELS[order.restaurant_status] ?? { label: order.restaurant_status, tone: "amber" as const };
  const customerName = order.client?.full_name ?? "Customer";

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${toneClasses(status.tone)}`}>
            {status.label}
          </span>
          <span className="text-sm font-semibold text-gray-900">#{shortId(order)}</span>
        </div>
        <span className="text-xs text-gray-400">{relativeTime(order.created_at)}</span>
      </div>

      <div className="px-5 pb-4">
        <div className="text-sm text-gray-600">
          For <span className="font-medium text-gray-900">{customerName}</span>
        </div>

        {/* Items */}
        <ul className="mt-3 space-y-1.5">
          {order.items?.length ? order.items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-800">
                  <span className="font-semibold text-brand mr-2">×{item.quantity}</span>
                  {item.name}
                </span>
                <span className="text-gray-500 tabular-nums">{dollars(item.subtotal ?? item.price * item.quantity)}</span>
              </div>
              {item.selected_options && item.selected_options.length > 0 && (
                <div className="text-xs text-gray-500 pl-6">
                  {item.selected_options.map((o) => o.label).join(", ")}
                </div>
              )}
            </li>
          )) : (
            <li className="text-sm text-gray-400">No items recorded.</li>
          )}
        </ul>

        {/* Customer notes */}
        {order.client_notes && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Note:</span> {order.client_notes}
          </div>
        )}

        {/* Totals */}
        <div className="mt-3 flex items-center justify-between text-sm border-t border-gray-100 pt-3">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-900 tabular-nums">{dollars(order.total)}</span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Actions — acceptance is automatic on payment, so there is NO
            Accept button. A preparing order can be marked Ready or (rarely)
            Rejected; a ready order just waits for the driver. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {order.restaurant_status === "pending" && (
            <span className="text-sm text-gray-500 inline-flex items-center">
              Awaiting payment confirmation.
            </span>
          )}
          {order.restaurant_status === "preparing" && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => markReadyForPickup(order.id))}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                Mark ready for pickup
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejectOpen(true)}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {order.restaurant_status === "ready_for_pickup" && (
            <span className="text-sm text-gray-500 inline-flex items-center">
              Waiting for the driver to pick up.
            </span>
          )}
        </div>
      </div>

      {rejectOpen && (
        <RejectModal
          orderId={order.id}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}

function toneClasses(tone: "amber" | "blue" | "violet" | "green"): string {
  switch (tone) {
    case "amber": return "bg-amber-100 text-amber-800";
    case "blue": return "bg-blue-100 text-blue-800";
    case "violet": return "bg-violet-100 text-violet-800";
    case "green": return "bg-emerald-100 text-emerald-800";
  }
}
