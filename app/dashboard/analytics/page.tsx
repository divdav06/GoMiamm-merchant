import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { AnalyticsCharts, type Kpis, type TopItem, type HourBucket, type DayBucket } from "./AnalyticsCharts";

const WINDOW_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type OrderRow = {
  id: string;
  status: string;
  subtotal: number | null;
  total: number | null;
  created_at: string;
  delivered_at: string | null;
  items: { name: string; quantity: number | null; price: number | null; subtotal: number | null }[] | null;
};

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AnalyticsPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const since = new Date(Date.now() - WINDOW_DAYS * ONE_DAY_MS).toISOString();
  const supabase = createServerSupabase(cookies());

  const { data: rawOrders, error } = await supabase
    .from("orders")
    .select("id, status, subtotal, total, created_at, delivered_at, items:order_items(name, quantity, price, subtotal)")
    .eq("store_id", access.storeId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-4 text-sm text-red-600">Could not load analytics: {error.message}</p>
      </div>
    );
  }

  const orders = (rawOrders ?? []) as unknown as OrderRow[];

  // ── KPIs ─────────────────────────────────────────────────────────
  const total = orders.length;
  const delivered = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  const totalRevenue = delivered.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
  const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  // Fulfillment time = delivered_at - created_at, averaged over
  // delivered orders that have both timestamps. Reported in minutes.
  let fulfillmentSumMs = 0, fulfillmentCount = 0;
  for (const o of delivered) {
    if (!o.delivered_at) continue;
    const ms = new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime();
    if (ms > 0) {
      fulfillmentSumMs += ms;
      fulfillmentCount += 1;
    }
  }
  const avgFulfillmentMin = fulfillmentCount > 0 ? fulfillmentSumMs / fulfillmentCount / 60_000 : 0;

  const cancellationRate = total > 0 ? cancelled / total : 0;

  const kpis: Kpis = {
    totalRevenue,
    totalOrders: total,
    deliveredOrders: delivered.length,
    avgOrderValue,
    avgFulfillmentMin,
    cancellationRate,
  };

  // ── Top items ────────────────────────────────────────────────────
  // Aggregate by item name across all orders in the window (delivered
  // only — refunded/cancelled lines shouldn't count toward "what sold").
  const byItem = new Map<string, { name: string; revenue: number; quantity: number }>();
  for (const o of delivered) {
    for (const item of o.items ?? []) {
      const name = item.name?.trim() || "Unknown";
      const qty = Number(item.quantity ?? 0);
      const sub = Number(item.subtotal ?? (Number(item.price ?? 0) * qty));
      const cur = byItem.get(name) ?? { name, revenue: 0, quantity: 0 };
      cur.revenue += sub;
      cur.quantity += qty;
      byItem.set(name, cur);
    }
  }
  const itemRows = Array.from(byItem.values());
  const topByRevenue: TopItem[] = [...itemRows].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topByQuantity: TopItem[] = [...itemRows].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  // ── Peak hours (orders count per hour-of-day in local time) ─────
  const hourCounts: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
  }));
  for (const o of orders) {
    const d = new Date(o.created_at);
    const h = d.getHours();
    if (hourCounts[h]) hourCounts[h].orders += 1;
  }

  // ── Last 7 days revenue line chart ───────────────────────────────
  const weeklyMap = new Map<string, DayBucket>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * ONE_DAY_MS);
    const key = localDayKey(d);
    weeklyMap.set(key, {
      day: key,
      label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      revenue: 0,
      orders: 0,
    });
  }
  const sevenDaysAgoMs = today.getTime() - 6 * ONE_DAY_MS;
  for (const o of delivered) {
    if (!o.delivered_at) continue;
    const at = new Date(o.delivered_at);
    if (at.getTime() < sevenDaysAgoMs) continue;
    const key = localDayKey(at);
    const cur = weeklyMap.get(key);
    if (cur) {
      cur.revenue += Number(o.subtotal ?? 0);
      cur.orders += 1;
    }
  }
  const weeklyTrend: DayBucket[] = Array.from(weeklyMap.values());

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · last {WINDOW_DAYS} days. Revenue figures are gross subtotal of delivered orders.
        </p>
      </header>

      <AnalyticsCharts
        kpis={kpis}
        topByRevenue={topByRevenue}
        topByQuantity={topByQuantity}
        peakHours={hourCounts}
        weeklyTrend={weeklyTrend}
      />
    </div>
  );
}
