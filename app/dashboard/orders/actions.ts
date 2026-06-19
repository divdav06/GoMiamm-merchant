"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { refundPaymentIntent } from "@/lib/stripe";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

// Merchant-side KITCHEN state machine, writing orders.restaurant_status:
//   pending → accepted → preparing → ready_for_pickup
//   pending|accepted → rejected (+ cancels the driver/dispatch track)
//
// orders.status is the SEPARATE driver/dispatch track and is NEVER written
// here except by reject (which must also cancel the order). The two tracks
// share no transition guard, so neither blocks the other.
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
    .select("id, store_id, status, restaurant_status, driver_id, client_id, payment_status, stripe_payment_intent_id, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");
  if (order.store_id !== storeId) throw new Error("Order belongs to another store");
  return order;
}

// Customer order pushes. Inserting a notifications row fires the
// trg_push_on_notification pg_net trigger → send-push automatically.
// (The 'preparing' push fires from stripe-webhook on payment, since
// acceptance is automatic — these are the merchant's manual actions.)
const ORDER_PUSH = {
  ready_for_pickup: {
    en: { title: "Order ready", body: "Your order is ready and waiting for the driver." },
    fr: { title: "Commande prête", body: "Votre commande est prête et attend le livreur." },
  },
  rejected: {
    en: { title: "Order declined", body: "The restaurant couldn't accept your order — you won't be charged." },
    fr: { title: "Commande refusée", body: "Le restaurant n'a pas pu accepter votre commande — vous ne serez pas débité." },
  },
  rejected_refund: {
    en: { title: "Order declined", body: "The restaurant couldn't accept your order. Your payment is being refunded." },
    fr: { title: "Commande refusée", body: "Le restaurant n'a pas pu accepter votre commande. Votre paiement est en cours de remboursement." },
  },
} as const;

async function notifyOrderCustomer(orderId: string, key: keyof typeof ORDER_PUSH) {
  const admin = createAdminSupabase();
  const { data: o } = await admin.from("orders").select("client_id").eq("id", orderId).maybeSingle();
  if (!o?.client_id) return;
  const { data: c } = await admin.from("clients").select("preferred_language").eq("id", o.client_id).maybeSingle();
  const copy = ORDER_PUSH[key][c?.preferred_language === "fr" ? "fr" : "en"];
  await admin.from("notifications").insert({
    user_id: o.client_id,
    title: copy.title,
    body: copy.body,
    type: "order",
    data: { order_id: orderId, kind: key },
  });
}

// Kitchen-track setter — writes restaurant_status ONLY. Race-safe: if another
// tab beat us to it the WHERE clause won't match and the UPDATE no-ops.
async function setRestaurantStatus(orderId: string, expectedPrior: string[], next: string) {
  const access = await requireAuthed();
  const order = await loadOwnedOrder(orderId, access.storeId);
  if (!expectedPrior.includes(order.restaurant_status)) {
    throw new Error(`Cannot transition kitchen status from "${order.restaurant_status}" to "${next}"`);
  }
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("orders")
    .update({ restaurant_status: next })
    .eq("id", orderId)
    .eq("restaurant_status", order.restaurant_status);
  if (error) throw error;
  revalidatePath("/dashboard/orders");
}

// NOTE: there is intentionally NO acceptOrder / markPreparing here.
// Restaurant acceptance is ALWAYS automatic — stripe-webhook moves the
// kitchen track straight to 'preparing' on payment. The merchant's only
// actions are markReadyForPickup and rejectOrder.

export async function markReadyForPickup(orderId: string): Promise<void> {
  await setRestaurantStatus(orderId, ["preparing"], "ready_for_pickup");
  await notifyOrderCustomer(orderId, "ready_for_pickup");
}

export async function rejectOrder(orderId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Reason required");
  const access = await requireAuthed();
  const order = await loadOwnedOrder(orderId, access.storeId);
  if (order.restaurant_status === "rejected" || order.status === "cancelled") return; // idempotent
  // Reject only while the kitchen hasn't already handed the food off
  // (pending / preparing) AND the driver hasn't physically taken it
  // (driver track still pending / accepted).
  if (!["pending", "preparing"].includes(order.restaurant_status)) {
    throw new Error("Order can no longer be rejected — it is already marked ready.");
  }
  if (!["pending", "accepted"].includes(order.status)) {
    throw new Error("Order can no longer be rejected — the driver is already en route.");
  }
  const admin = createAdminSupabase();
  // Atomic: mark the kitchen rejected AND cancel the driver/dispatch track in
  // one UPDATE. Race-safe on status so we never cancel a just-picked-up order.
  // status='cancelled' stops dispatch (expire-order / recover-stale-orders /
  // accept-order all key on status='pending').
  const { data: updated, error } = await admin
    .from("orders")
    .update({
      restaurant_status: "rejected",
      status: "cancelled",
      cancellation_reason: trimmed.slice(0, 500),
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .in("status", ["pending", "accepted"])
    .select("id, client_id, driver_id, payment_status, stripe_payment_intent_id, order_number")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error("Order can no longer be rejected.");
  // MONEY: customer is charged at checkout (immediate capture), so a reject
  // after payment MUST refund. stripe-webhook's charge.refunded handler then
  // flips payment_status='refunded' and records the refunds row.
  const wasPaid = updated.payment_status === "paid" && !!updated.stripe_payment_intent_id;
  if (wasPaid) {
    await refundPaymentIntent(updated.stripe_payment_intent_id as string, `reject-${orderId}`);
  }
  await notifyOrderCustomer(orderId, wasPaid ? "rejected_refund" : "rejected");
  // If a driver had already claimed it, tell them to return to idle
  // (mirrors update-order-status' client-cancel → driver notification).
  if (updated.driver_id) {
    await admin.from("notifications").insert({
      user_id: updated.driver_id,
      title: "Order cancelled",
      body: `Restaurant rejected ${updated.order_number ?? orderId.slice(0, 8)} — return to idle.`,
      type: "order",
      data: { order_id: orderId, cancelled_by: "restaurant" },
    });
  }
  revalidatePath("/dashboard/orders");
}
