"use server";

import { revalidatePath } from "next/cache";

import { checkPartnerAccess } from "@/lib/checkPartnerAccess";
import { createAdminSupabase } from "@/lib/supabaseAdmin";

import { DAY_KEYS, type WeeklyHours } from "./types";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(schedule: WeeklyHours): WeeklyHours {
  const normalized = {} as WeeklyHours;
  for (const k of DAY_KEYS) {
    const v = schedule[k];
    if (!v || typeof v !== "object") throw new Error(`Missing schedule for ${k}`);
    if (!TIME_RE.test(v.open) || !TIME_RE.test(v.close)) {
      throw new Error(`Invalid HH:MM time for ${k}`);
    }
    if (v.is_open && v.open >= v.close) {
      throw new Error(`Close must be after open for ${k}`);
    }
    normalized[k] = {
      is_open: !!v.is_open,
      open: v.open,
      close: v.close,
    };
  }
  return normalized;
}

async function requireAuthed() {
  const access = await checkPartnerAccess();
  if (!access) throw new Error("Unauthorized");
  return access;
}

export async function setOpenNow(next: boolean): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("stores")
    .update({ is_open_now: next })
    .eq("id", access.storeId);
  if (error) throw error;
  revalidatePath("/dashboard/hours");
}

// Pass minutes in the future to pause; pass null to clear the pause.
export async function setPause(minutes: number | null): Promise<void> {
  const access = await requireAuthed();
  const admin = createAdminSupabase();
  let value: string | null = null;
  if (minutes != null) {
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) {
      throw new Error("Pause window must be 1–1440 minutes");
    }
    value = new Date(Date.now() + minutes * 60_000).toISOString();
  }
  const { error } = await admin
    .from("stores")
    .update({ pause_orders_until: value })
    .eq("id", access.storeId);
  if (error) throw error;
  revalidatePath("/dashboard/hours");
}

export async function saveWeeklyHours(schedule: WeeklyHours): Promise<void> {
  const access = await requireAuthed();
  const normalized = validate(schedule);
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("stores")
    .update({ hours_json: normalized })
    .eq("id", access.storeId);
  if (error) throw error;
  revalidatePath("/dashboard/hours");
}
