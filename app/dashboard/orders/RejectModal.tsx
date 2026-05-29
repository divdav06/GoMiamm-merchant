"use client";

import { useState } from "react";

import { rejectOrder } from "./actions";

type Props = {
  orderId: string;
  onClose: () => void;
};

const PRESET_REASONS = [
  "Item unavailable",
  "Kitchen too busy",
  "Closing soon",
  "Cannot fulfill in time",
];

export function RejectModal({ orderId, onClose }: Props) {
  const [preset, setPreset] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = preset ?? other.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await rejectOrder(orderId, reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Reject order</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            The customer will be refunded automatically. Please tell us why so we can keep your store
            healthy.
          </p>

          <div className="space-y-2">
            {PRESET_REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer ${preset === r ? "border-brand bg-brand/5" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input
                  type="radio"
                  name="preset-reason"
                  className="accent-brand"
                  checked={preset === r}
                  onChange={() => { setPreset(r); setOther(""); }}
                />
                <span className="text-sm text-gray-800">{r}</span>
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="other-reason" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Or another reason
            </label>
            <textarea
              id="other-reason"
              rows={2}
              value={other}
              onChange={(e) => { setOther(e.target.value); setPreset(null); }}
              placeholder="Tell us what's going on…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none text-sm"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !reason}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Rejecting…" : "Reject order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
