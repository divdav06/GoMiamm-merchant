"use client";

import { useEffect, useState, useTransition } from "react";

import { createBrowserSupabase } from "@/lib/supabase";

import { deleteMenuItem, toggleAvailability } from "./actions";
import { MenuItemModal } from "./MenuItemModal";

export type MenuItem = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean | null;
};

type Props = {
  storeId: string;
  initialItems: MenuItem[];
};

function priceToDollars(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

export function MenuList({ storeId, initialItems }: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

  // Realtime: keep the list in sync with the DB. We use the browser
  // Supabase client (cookie-bridged session); RLS on menu_items is
  // currently `Anyone can view menu items USING (true)` so all
  // postgres_changes events for this store are visible.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`menu-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MenuItem;
            setItems((prev) => (prev.some((p) => p.id === row.id) ? prev : sortItems([...prev, row])));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MenuItem;
            setItems((prev) => sortItems(prev.map((p) => (p.id === row.id ? row : p))));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as Pick<MenuItem, "id">;
            setItems((prev) => prev.filter((p) => p.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  async function onToggle(item: MenuItem) {
    setBusyToggle(item.id);
    try {
      await toggleAvailability(item.id, !(item.is_available ?? true));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not update: ${msg}`);
    } finally {
      setBusyToggle(null);
    }
  }

  function onDelete(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteMenuItem(item.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Could not delete: ${msg}`);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">{items.length} item{items.length === 1 ? "" : "s"}</div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center px-3 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 transition-colors"
        >
          + Add item
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState onAdd={() => setCreating(true)} />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm p-3 flex gap-4 items-center"
            >
              <Thumb url={item.image_url} alt={item.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                  {item.category && (
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                      {item.category}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                )}
                <div className="text-sm font-semibold text-gray-800 mt-1">
                  {priceToDollars(item.price)}
                </div>
              </div>

              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={item.is_available ?? true}
                  onChange={() => onToggle(item)}
                  disabled={busyToggle === item.id}
                />
                <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand/30 rounded-full peer-checked:bg-brand transition-colors relative">
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${item.is_available ?? true ? "translate-x-4" : ""}`} />
                </div>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  disabled={pending}
                  className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <MenuItemModal
          mode="create"
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <MenuItemModal
          mode="edit"
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function sortItems(rows: MenuItem[]): MenuItem[] {
  return [...rows].sort((a, b) => {
    const ca = (a.category ?? "").toLowerCase();
    const cb = (b.category ?? "").toLowerCase();
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="w-16 h-16 rounded-xl object-cover bg-gray-100"
    />
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
      <div className="text-sm text-gray-500 mb-3">No items on your menu yet.</div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center px-3 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600"
      >
        + Add your first item
      </button>
    </div>
  );
}
