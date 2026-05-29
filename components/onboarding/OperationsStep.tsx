"use client";

import { useState } from "react";

import type { OnboardingCopy } from "@/lib/onboardingCopy";

// Phase F.4 — Operations form. Three fields land in
// restaurant_signups.operations_info jsonb when the merchant submits.
// Numeric inputs stay as strings in component state (HTML input
// type="number" hands React a string) and are parsed at submit time;
// the exported OperationsInfo type holds numbers for the server.

const CUISINE_OPTIONS = [
  "Italian",
  "French",
  "Asian",
  "American",
  "Mexican",
  "Indian",
  "Other",
] as const;

export type OperationsInfo = {
  cuisine_type: string;
  kitchen_capacity: number;     // orders / hour
  delivery_radius_km: number;
};

type FormState = {
  cuisine_type: string;
  kitchen_capacity: string;
  delivery_radius_km: string;
};

function fromInitial(initial?: Partial<OperationsInfo>): FormState {
  return {
    cuisine_type: initial?.cuisine_type ?? "",
    kitchen_capacity: initial?.kitchen_capacity != null ? String(initial.kitchen_capacity) : "",
    delivery_radius_km: initial?.delivery_radius_km != null ? String(initial.delivery_radius_km) : "",
  };
}

type Props = {
  initial?: Partial<OperationsInfo>;
  onSubmit?: (data: OperationsInfo) => Promise<void> | void;
  copy: OnboardingCopy["operations"];
  common: OnboardingCopy["common"];
};

export function OperationsStep({ initial, onSubmit, copy, common }: Props) {
  const [data, setData] = useState<FormState>(fromInitial(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const kitchenCapacityN = Number(data.kitchen_capacity);
  const deliveryRadiusN = Number(data.delivery_radius_km);
  const canSubmit =
    data.cuisine_type.trim() !== "" &&
    Number.isFinite(kitchenCapacityN) && kitchenCapacityN > 0 &&
    Number.isFinite(deliveryRadiusN) && deliveryRadiusN > 0;

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit || !onSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        cuisine_type: data.cuisine_type.trim(),
        kitchen_capacity: kitchenCapacityN,
        delivery_radius_km: deliveryRadiusN,
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

      <Field label={copy.cuisine.label} required>
        <select
          required
          value={data.cuisine_type}
          onChange={(e) => set("cuisine_type", e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">{copy.cuisine.placeholder}</option>
          {CUISINE_OPTIONS.map((c) => (
            <option key={c} value={c}>{copy.cuisine.options[c]}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={copy.capacity.label}
          required
          hint={copy.capacity.hint}
        >
          <div className="relative">
            <input
              type="number"
              required
              min={1}
              step={1}
              inputMode="numeric"
              value={data.kitchen_capacity}
              onChange={(e) => set("kitchen_capacity", e.target.value)}
              placeholder={copy.capacity.placeholder}
              className={`${INPUT_CLS} pr-24`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              {copy.capacity.unit}
            </span>
          </div>
        </Field>
        <Field
          label={copy.radius.label}
          required
          hint={copy.radius.hint}
        >
          <div className="relative">
            <input
              type="number"
              required
              min={1}
              step={0.5}
              inputMode="decimal"
              value={data.delivery_radius_km}
              onChange={(e) => set("delivery_radius_km", e.target.value)}
              placeholder={copy.radius.placeholder}
              className={`${INPUT_CLS} pr-12`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              {copy.radius.unit}
            </span>
          </div>
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
