import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { OrderList, type ActiveOrder } from "./OrderList";

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup"] as const;

export default async function OrdersPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const { data: orders, error } = await supabase
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
      client_notes,
      created_at,
      client:profiles!orders_client_id_fkey(id, full_name),
      items:order_items(id, name, quantity, price, subtotal)
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

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · pending / accepted / preparing / ready for pickup.
        </p>
      </header>

      <OrderList storeId={access.storeId} initialOrders={(orders ?? []) as unknown as ActiveOrder[]} />
    </div>
  );
}
