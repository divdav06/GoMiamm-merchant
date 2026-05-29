"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type Kpis = {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  avgOrderValue: number;
  avgFulfillmentMin: number;
  cancellationRate: number;
};
export type TopItem = { name: string; revenue: number; quantity: number };
export type HourBucket = { hour: number; orders: number };
export type DayBucket = { day: string; label: string; revenue: number; orders: number };

type Props = {
  kpis: Kpis;
  topByRevenue: TopItem[];
  topByQuantity: TopItem[];
  peakHours: HourBucket[];
  weeklyTrend: DayBucket[];
};

const BRAND = "#FF6A35";
const BRAND_LIGHT = "#FFD3BF";
const GRID = "#E5E7EB";
const TEXT_MUTED = "#6B7280";

function dollars(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

function percent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

// Visual intensity for the peak-hours chart — peak hour is fully
// brand-orange, off-peak hours fade toward gray. Pure visual cue; the
// dataKey value itself stays the raw count.
function hourFill(value: number, max: number): string {
  if (max <= 0) return GRID;
  const t = value / max;
  if (t >= 0.85) return BRAND;
  if (t >= 0.5) return "#FF9871";
  if (t >= 0.2) return BRAND_LIGHT;
  return "#F3F4F6";
}

export function AnalyticsCharts({ kpis, topByRevenue, topByQuantity, peakHours, weeklyTrend }: Props) {
  const peakMax = Math.max(0, ...peakHours.map((h) => h.orders));

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label="Revenue" value={dollars(kpis.totalRevenue)} hint="gross subtotal" />
        <Kpi label="Orders" value={String(kpis.totalOrders)} hint={`${kpis.deliveredOrders} delivered`} />
        <Kpi label="Avg order" value={dollars(kpis.avgOrderValue)} hint="per delivered" />
        <Kpi
          label="Fulfillment"
          value={kpis.avgFulfillmentMin > 0 ? `${Math.round(kpis.avgFulfillmentMin)} min` : "—"}
          hint="placed → delivered"
        />
        <Kpi label="Cancel rate" value={percent(kpis.cancellationRate)} hint="of all orders" />
      </section>

      {/* Weekly trend */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Last 7 days revenue
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={TEXT_MUTED} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={TEXT_MUTED}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(v) => dollars(Number(v))}
                labelFormatter={(l) => String(l)}
                contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2} fill="url(#weeklyFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top items grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopChart title="Top items by revenue" data={topByRevenue} dataKey="revenue" valueFormat={dollars} />
        <TopChart title="Top items by quantity" data={topByQuantity} dataKey="quantity" valueFormat={(n) => `${n}`} />
      </section>

      {/* Peak hours */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Peak hours
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Orders placed by hour of day (local time, last {30} days).
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHours} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke={TEXT_MUTED}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(h: number) => hourLabel(h)}
              />
              <YAxis
                stroke={TEXT_MUTED}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [`${Number(v)} orders`, ""] as [string, string]}
                labelFormatter={(h) => hourLabel(Number(h))}
                contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
              />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {peakHours.map((h) => (
                  <Cell key={h.hour} fill={hourFill(h.orders, peakMax)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-400">{label}</div>
      <div className="text-2xl font-bold mt-1 text-gray-900">{value}</div>
      <div className="text-xs mt-1 text-gray-500">{hint}</div>
    </div>
  );
}

function TopChart({
  title,
  data,
  dataKey,
  valueFormat,
}: {
  title: string;
  data: TopItem[];
  dataKey: "revenue" | "quantity";
  valueFormat: (n: number) => string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
        {title}
      </h2>
      {data.length === 0 ? (
        <div className="text-sm text-gray-400 py-10 text-center">No data in the window.</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke={TEXT_MUTED}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (dataKey === "revenue" ? `$${v}` : String(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={TEXT_MUTED}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                formatter={(v) => [valueFormat(Number(v)), ""] as [string, string]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
              />
              <Bar dataKey={dataKey} fill={BRAND} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
