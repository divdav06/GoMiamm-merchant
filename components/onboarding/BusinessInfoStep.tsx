"use client";

import { useState } from "react";

import type { OnboardingCopy } from "@/lib/onboardingCopy";

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
  copy: OnboardingCopy["business"];
  common: OnboardingCopy["common"];
};

export function BusinessInfoStep({ initial, onSubmit, copy, common }: Props) {
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
        <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Field label={copy.legal_name.label} required>
        <input
          type="text"
          required
          value={data.legal_name}
          onChange={(e) => set("legal_name", e.target.value)}
          placeholder={copy.legal_name.placeholder}
          className={INPUT_CLS}
        />
      </Field>

      <Field label={copy.dba.label} hint={copy.dba.hint}>
        <input
          type="text"
          value={data.dba}
          onChange={(e) => set("dba", e.target.value)}
          placeholder={copy.dba.placeholder}
          className={INPUT_CLS}
        />
      </Field>

      <Field label={copy.address.label} required>
        <textarea
          required
          rows={2}
          value={data.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder={copy.address.placeholder}
          className={`${INPUT_CLS} resize-none`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={copy.phone.label} required>
          <input
            type="tel"
            required
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder={copy.phone.placeholder}
            className={INPUT_CLS}
          />
        </Field>
        <Field label={copy.tax_id.label} required hint={copy.tax_id.hint}>
          <input
            type="text"
            required
            value={data.tax_id}
            onChange={(e) => set("tax_id", e.target.value)}
            placeholder={copy.tax_id.placeholder}
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
          {busy ? common.saving : common.continue}
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
