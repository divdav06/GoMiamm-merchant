"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase";

import { OrderCard } from "./OrderCard";

export type SelectedOption = {
  group_name: string;
  label: string;
  price_delta: number;
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  selected_options: SelectedOption[] | null;
};

export type ActiveOrder = {
  id: string;
  order_number: string | null;
  status: string;
  restaurant_status: string;
  subtotal: number | null;
  delivery_fee: number | null;
  service_fee: number | null;
  tip: number | null;
  total: number | null;
  client_notes: string | null;
  created_at: string;
  client: { id: string; full_name: string | null } | null;
  items: OrderItem[];
};

type Props = {
  storeId: string;
  initialOrders: ActiveOrder[];
};

// Kitchen worklist membership: restaurant track open AND the driver hasn't
// picked it up / it isn't terminal. Mirrors the server query in page.tsx.
const REST_ACTIVE = new Set(["pending", "preparing", "ready_for_pickup"]);
const DRIVER_DONE = new Set(["picking_up", "in_transit", "delivered", "cancelled"]);
const isKitchenActive = (r: { restaurant_status?: string; status?: string }) =>
  REST_ACTIVE.has(r.restaurant_status ?? "") && !DRIVER_DONE.has(r.status ?? "");

// Three short beeps when a new pending order lands. We build the tone
// in a freshly-created AudioContext on each chime so iOS Safari's
// "context must be created from a user gesture" rule is satisfied as
// long as the user has interacted with the page at least once
// (logging in counts). No external audio asset = no Pages deploy
// asset to manage.
function playNewOrderChime() {
  try {
    type WindowWithWebkit = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
    setTimeout(() => { void ctx.close().catch(() => {}); }, 700);
  } catch {
    // Audio is best-effort; never blow up the realtime stream over it.
  }
}

export function OrderList({ storeId, initialOrders }: Props) {
  const [orders, setOrders] = useState<ActiveOrder[]>(initialOrders);
  const orderIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));

  const refetchOne = useCallback(async (orderId: string) => {
    // Same two-hop pattern as orders/page.tsx — there's no FK from
    // orders.client_id to profiles, so we fetch the order with
    // client_id only, then look up the customer name from profiles
    // separately and stitch it on.
    const supabase = createBrowserSupabase();
    const { data: order } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, restaurant_status, subtotal, delivery_fee, service_fee, tip, total,
        client_id, client_notes, created_at,
        items:order_items(id, name, quantity, price, subtotal, selected_options)
      `)
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return null;
    let client: { id: string; full_name: string | null } | null = null;
    if (order.client_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", order.client_id)
        .maybeSingle();
      client = (profile as { id: string; full_name: string | null } | null) ?? null;
    }
    return ({ ...order, client } as unknown as ActiveOrder);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`orders-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; status: string; restaurant_status: string };
            if (!isKitchenActive(row)) return;
            const full = await refetchOne(row.id);
            if (!full) return;
            setOrders((prev) => {
              if (prev.some((p) => p.id === full.id)) return prev;
              return [...prev, full].sort(byCreatedAt);
            });
            orderIdsRef.current.add(full.id);
            // New actionable order = restaurant auto-accepted → 'preparing'.
            if (full.restaurant_status === "preparing") playNewOrderChime();
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as { id: string; status: string; restaurant_status: string };
            // Order left the active window — remove.
            if (!isKitchenActive(row)) {
              setOrders((prev) => prev.filter((p) => p.id !== row.id));
              orderIdsRef.current.delete(row.id);
              return;
            }
            const full = await refetchOne(row.id);
            if (!full) return;
            const wasKnown = orderIdsRef.current.has(full.id);
            setOrders((prev) => {
              const next = prev.some((p) => p.id === full.id)
                ? prev.map((p) => (p.id === full.id ? full : p))
                : [...prev, full];
              return next.sort(byCreatedAt);
            });
            orderIdsRef.current.add(full.id);
            // If this UPDATE moved an order INTO our active window for the
            // first time (e.g. payment flipped pending → preparing), chime.
            if (!wasKnown && full.restaurant_status === "preparing") playNewOrderChime();
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setOrders((prev) => prev.filter((p) => p.id !== row.id));
            orderIdsRef.current.delete(row.id);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, refetchOne]);

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
        <div className="text-sm text-gray-500">No active orders right now.</div>
        <div className="text-xs text-gray-400 mt-1">New orders will appear here in real time.</div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  );
}

function byCreatedAt(a: ActiveOrder, b: ActiveOrder): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}
