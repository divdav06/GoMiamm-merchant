import { cookies } from "next/headers";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createServerSupabase } from "@/lib/supabase";

import { DAY_KEYS, type DayKey, type WeeklyHours } from "./actions";
import { HoursForm } from "./HoursForm";

const DEFAULT_DAY = { is_open: true, open: "08:00", close: "22:00" };

function normalizeSchedule(raw: unknown): WeeklyHours {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as WeeklyHours;
  for (const k of DAY_KEYS) {
    const v = obj[k];
    if (v && typeof v === "object") {
      const day = v as { is_open?: unknown; open?: unknown; close?: unknown };
      out[k] = {
        is_open: typeof day.is_open === "boolean" ? day.is_open : DEFAULT_DAY.is_open,
        open: typeof day.open === "string" ? day.open : DEFAULT_DAY.open,
        close: typeof day.close === "string" ? day.close : DEFAULT_DAY.close,
      };
    } else {
      out[k] = { ...DEFAULT_DAY };
    }
  }
  return out;
}

export default async function HoursPage() {
  const access = await checkPartnerAccess();
  if (!access) return null;

  const supabase = createServerSupabase(cookies());
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, is_open_now, pause_orders_until, hours_json")
    .eq("id", access.storeId)
    .maybeSingle();

  if (!store) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Hours</h1>
        <p className="mt-4 text-sm text-red-600">Could not load your store record.</p>
      </div>
    );
  }

  const schedule = normalizeSchedule(store.hours_json);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Hours</h1>
        <p className="text-gray-500 text-sm mt-1">
          {access.storeName} · open/closed override, rush-mode pause, and weekly schedule.
        </p>
      </header>

      <HoursForm
        initialOpenNow={!!store.is_open_now}
        initialPauseUntil={store.pause_orders_until ?? null}
        initialSchedule={schedule}
      />
    </div>
  );
}
