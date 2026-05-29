"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Merchant-side order state machine. Source-of-truth statuses today
// (per orders.status text column with no CHECK):
//   pending → accepted → preparing → ready_for_pickup → … (driver/customer side)
//   pending → cancelled
//
// Each action re-authenticates via checkPartnerAccess and verifies
// orders.store_id matches before mutating. Service-role bypasses RLS.

async function requireAuthed() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  return access;
}

async function loadOwnedOrder(orderId: string, storeId: string) {
  const admin = createAdminSupabase();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, store_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");
  if (order.store_id !== storeId) throw new Error("Order belongs to another store");
  return order;
}

async function setStatus(orderId: string, expectedPrior: string[], next: string, extra: Record<string, unknown> = {}) {
  const access = await requireAuthed();
  const order = await loadOwnedOrder(orderId, access.storeId);
  if (!expectedPrior.includes(order.status)) {
    throw new Error(`Cannot transition from "${order.status}" to "${next}"`);
  }
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("orders")
    .update({ status: next, ...extra })
    .eq("id", orderId)
    // Belt + suspenders: race-safe — if another tab beat us to it the
    // WHERE clause won't match and the UPDATE silently no-ops.
    .eq("status", order.status);
  if (error) throw error;
  revalidatePath("/dashboard/orders");
}

export async function acceptOrder(orderId: string): Promise<void> {
  await setStatus(orderId, ["pending"], "accepted");
}

export async function rejectOrder(orderId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Reason required");
  await setStatus(orderId, ["pending"], "cancelled", {
    cancellation_reason: trimmed.slice(0, 500),
    cancelled_at: new Date().toISOString(),
  });
}

export async function markPreparing(orderId: string): Promise<void> {
  await setStatus(orderId, ["accepted"], "preparing");
}

export async function markReadyForPickup(orderId: string): Promise<void> {
  await setStatus(orderId, ["preparing"], "ready_for_pickup");
}
