"use client";

import { useState } from "react";

// Phase F.3 — Business info form. Captures the data that goes into
// restaurant_signups.business_info jsonb (advanced as a single block
// when the merchant submits — server wiring lands in a follow-up).
//
// Required: legal_name, address, phone, tax_id (needed for 1099 / W-9
// reporting). DBA is optional — many sole-proprietor restaurants
// operate under the legal entity name without a separate trade name.

export type BusinessInfo = {
  legal_name: string;
  dba: string;
  address: string;
  phone: string;
  tax_id: string;
};

const EMPTY: BusinessInfo = {
  legal_name: "",
  dba: "",
  address: "",
  phone: "",
  tax_id: "",
};

type Props = {
  initial?: Partial<BusinessInfo>;
  onSubmit?: (data: BusinessInfo) => Promise<void> | void;
};

export function BusinessInfoStep({ initial, onSubmit }: Props) {
  const [data, setData] = useState<BusinessInfo>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BusinessInfo>(key: K, value: BusinessInfo[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    data.legal_name.trim() !== "" &&
    data.address.trim() !== "" &&
    data.phone.trim() !== "" &&
    data.tax_id.trim() !== "";

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit || !onSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        legal_name: data.legal_name.trim(),
        dba: data.dba.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        tax_id: data.tax_id.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onFormSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Business info</h2>
        <p className="text-sm text-gray-500 mt-1">
          The legal entity that signs the partner agreement and receives payouts.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Field label="Legal name" required>
        <input
          type="text"
          required
          value={data.legal_name}
          onChange={(e) => set("legal_name", e.target.value)}
          placeholder="GoMiamm Test Kitchen LLC"
          className={INPUT_CLS}
        />
      </Field>

      <Field label="Doing business as" hint="Trade name shown to customers, if different from the legal name.">
        <input
          type="text"
          value={data.dba}
          onChange={(e) => set("dba", e.target.value)}
          placeholder="The Kitchen"
          className={INPUT_CLS}
        />
      </Field>

      <Field label="Business address" required>
        <textarea
          required
          rows={2}
          value={data.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="123 Main St, St Augustine FL 32084"
          className={`${INPUT_CLS} resize-none`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone" required>
          <input
            type="tel"
            required
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 555 1234"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Tax ID (EIN or SSN)" required hint="Used for 1099 / W-9 tax reporting. Never shown to customers.">
          <input
            type="text"
            required
            value={data.tax_id}
            onChange={(e) => set("tax_id", e.target.value)}
            placeholder="12-3456789"
            className={INPUT_CLS}
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
        {required && <span className="text-brand ml-0.5">*</span>}
      </span>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </label>
  );
}
