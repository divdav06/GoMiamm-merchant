"use client";

import { useState } from "react";

import { CUISINES } from "@/lib/cuisines";

import { updateStoreProfile } from "./actions";

export type StoreProfile = {
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  category: string | null;
  cuisine: string | null;
  website_url: string | null;
};

// Editable store profile, parity with the native Partners app Settings
// tab (app/(tabs)/settings.tsx). Six fields: name + address required,
// the rest optional. Manual onSubmit + busy/error state mirrors
// MenuItemModal rather than reaching for useFormStatus.
export function ProfileForm({ profile }: { profile: StoreProfile }) {
  const [name, setName] = useState(profile.name ?? "");
  const [description, setDescription] = useState(profile.description ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [category, setCategory] = useState(profile.category ?? "");
  const [cuisine, setCuisine] = useState(profile.cuisine ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    name !== (profile.name ?? "") ||
    description !== (profile.description ?? "") ||
    address !== (profile.address ?? "") ||
    phone !== (profile.phone ?? "") ||
    category !== (profile.category ?? "") ||
    cuisine !== (profile.cuisine ?? "") ||
    websiteUrl !== (profile.website_url ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("description", description);
      fd.set("address", address);
      fd.set("phone", phone);
      fd.set("category", category);
      fd.set("cuisine", cuisine);
      fd.set("website_url", websiteUrl);
      await updateStoreProfile(fd);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && !dirty && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved.
        </div>
      )}

      <Field label="Name">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          placeholder="Mario's Pizzeria"
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={2}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
          placeholder="Wood-fired Neapolitan pizza in downtown."
        />
      </Field>

      <Field label="Address">
        <input
          type="text"
          required
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          placeholder="123 Main St, Detroit, MI"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            placeholder="(313) 555-0123"
          />
        </Field>
        <Field label="Category">
          <input
            type="text"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSaved(false);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            placeholder="Italian"
          />
        </Field>
      </div>

      <Field label="Cuisine">
        <select
          value={cuisine}
          onChange={(e) => {
            setCuisine(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        >
          <option value="">— Select cuisine —</option>
          {CUISINES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <span className="block mt-1 text-xs text-gray-400">
          Shown to customers under the matching home-screen category chip.
        </span>
      </Field>

      <Field label="Website">
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => {
            setWebsiteUrl(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          placeholder="https://mariospizza.com"
        />
      </Field>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={busy || !dirty || !name || !address}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
