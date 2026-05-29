// Type + constant exports for the hours dashboard. Lives in its own
// file because Next.js Server Actions (files marked "use server") may
// only export async functions — re-exporting types or constants from
// actions.ts trips the "A 'use server' file can only export async
// functions" build error.

export type DaySchedule = {
  is_open: boolean;
  open: string;   // "HH:MM" 24h
  close: string;  // "HH:MM" 24h
};
export type WeeklyHours = Record<DayKey, DaySchedule>;
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
