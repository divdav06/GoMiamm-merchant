import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { OrderList, type ActiveOrder } from "./OrderList";

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup"] as const;

export default async function OrdersPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());

  // orders.client_id is FK'd to clients (not profiles), and clients
  // has no full_name column. Customer display names live in profiles
  // (profiles.id == clients.id == auth.users.id by construction; see
  // the customer-register edge function). Fetch orders + items inline,
  // then resolve names with a second profiles lookup.
  const { data: ordersData, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      subtotal,
      delivery_fee,
      service_fee,
      tip,
      total,
      client_id,
      client_notes,
      created_at,
      items:order_items(id, name, quantity, price, subtotal, selected_options)
    `)
    .eq("store_id", access.storeId)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-4 text-sm text-red-600">Could not load orders: {error.message}</p>
      </div>
    );
  }

  const clientIds = Array.from(
    new Set((ordersData ?? []).map((o) => o.client_id).filter((id): id is string => !!id)),
  );
  const profileMap = new Map<string, { id: string; full_name: string | null }>();
  if (clientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", clientIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      profileMap.set(p.id, p);
    }
  }
  const orders = (ordersData ?? []).map((o) => ({
    ...o,
    client: o.client_id ? profileMap.get(o.client_id) ?? null : null,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · pending / accepted / preparing / ready for pickup.
        </p>
      </header>

      <OrderList storeId={access.storeId} initialOrders={orders as unknown as ActiveOrder[]} />
    </div>
  );
}
