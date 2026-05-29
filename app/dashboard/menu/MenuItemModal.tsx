"use client";

import { useState } from "react";

import { createMenuItem, updateMenuItem } from "./actions";
import type { MenuItem } from "./MenuList";

type Props =
  | { mode: "create"; onClose: () => void; item?: undefined }
  | { mode: "edit"; item: MenuItem; onClose: () => void };

// Form fields use a "price (cents)" integer convention to side-step
// floating-point and keep parity with the rest of the platform's
// currency math. The server action divides by 100 before persisting to
// the numeric `price` column so customer-app keeps reading dollars.
export function MenuItemModal(props: Props) {
  const initial = props.mode === "edit" ? props.item : undefined;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [priceCents, setPriceCents] = useState(
    initial?.price != null ? String(Math.round(Number(initial.price) * 100)) : "",
  );
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("description", description);
      fd.set("category", category);
      fd.set("price_cents", priceCents);
      fd.set("is_available", isAvailable ? "on" : "false");
      if (photo) fd.set("photo", photo);

      if (props.mode === "create") {
        await createMenuItem(fd);
      } else {
        await updateMenuItem(props.item.id, fd);
      }
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {props.mode === "create" ? "Add menu item" : "Edit item"}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
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
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Field label="Name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              placeholder="Margherita pizza"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
              placeholder="Tomato, mozzarella, basil."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (cents)">
              <input
                type="number"
                min={0}
                step={1}
                required
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="1299"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Integer cents. 1299 = $12.99
              </p>
            </Field>
            <Field label="Category">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="Pizzas"
              />
            </Field>
          </div>

          <Field label="Photo">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand/10 file:text-brand file:font-semibold hover:file:bg-brand/20"
            />
            {props.mode === "edit" && props.item.image_url && !photo && (
              <p className="text-[11px] text-gray-400 mt-1">
                Current photo is kept unless you pick a new one.
              </p>
            )}
          </Field>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-brand transition-colors relative">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isAvailable ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700">Available for orders</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={props.onClose}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name || !priceCents}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Saving…" : props.mode === "create" ? "Add item" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
