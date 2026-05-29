"use client";

import { useEffect, useState, useTransition } from "react";

import {
  DAY_KEYS,
  type DayKey,
  type WeeklyHours,
  saveWeeklyHours,
  setOpenNow,
  setPause,
} from "./actions";

type Props = {
  initialOpenNow: boolean;
  initialPauseUntil: string | null;
  initialSchedule: WeeklyHours;
};

const DAY_LABEL: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const PAUSE_OPTIONS = [15, 30, 60] as const;

function pauseRemainingMinutes(until: string | null, now: number): number {
  if (!until) return 0;
  const ms = new Date(until).getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 60_000);
}

export function HoursForm({ initialOpenNow, initialPauseUntil, initialSchedule }: Props) {
  const [openNow, setOpenNowLocal] = useState(initialOpenNow);
  const [pauseUntil, setPauseUntilLocal] = useState<string | null>(initialPauseUntil);
  const [schedule, setSchedule] = useState<WeeklyHours>(initialSchedule);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  // Re-render every 30s so the "X min remaining" countdown ticks down
  // without polling the server.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const pauseRemaining = pauseRemainingMinutes(pauseUntil, Date.now());
  const isPaused = pauseRemaining > 0;

  function runAction(action: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onToggleOpenNow() {
    const next = !openNow;
    setOpenNowLocal(next); // optimistic
    runAction(
      () => setOpenNow(next),
      () => {},
    );
  }

  function onPause(minutes: number | null) {
    const nextValue = minutes
      ? new Date(Date.now() + minutes * 60_000).toISOString()
      : null;
    setPauseUntilLocal(nextValue); // optimistic
    runAction(() => setPause(minutes));
  }

  function onSaveSchedule() {
    runAction(
      () => saveWeeklyHours(schedule),
      () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
      },
    );
  }

  function updateDay(day: DayKey, patch: Partial<WeeklyHours[DayKey]>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Big open/closed toggle */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <button
          type="button"
          onClick={onToggleOpenNow}
          disabled={pending}
          className={[
            "w-full rounded-xl py-6 px-5 text-left transition-colors disabled:opacity-50",
            openNow
              ? "bg-brand text-white hover:bg-brand-600"
              : "bg-gray-900 text-white hover:bg-gray-800",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-80">Right now</div>
              <div className="text-2xl font-bold mt-0.5">
                {openNow ? "Open" : "Closed"}
              </div>
              <div className="text-xs opacity-80 mt-1">
                Tap to mark your store {openNow ? "closed" : "open"}.
              </div>
            </div>
            <span
              aria-hidden="true"
              className={`inline-block w-3 h-3 rounded-full ${openNow ? "bg-white" : "bg-red-400"} shrink-0 mt-1`}
            />
          </div>
        </button>
      </section>

      {/* Rush mode / pause */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Rush mode
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pause incoming orders without closing for the day. Customers see a
              short delay; you stay listed.
            </p>
          </div>
          {isPaused && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
              Paused · {pauseRemaining} min
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PAUSE_OPTIONS.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => onPause(min)}
              disabled={pending}
              className={[
                "px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50",
                isPaused
                  ? "border-amber-300 text-amber-800 hover:bg-amber-50"
                  : "border-gray-200 text-gray-800 hover:bg-gray-50",
              ].join(" ")}
            >
              Pause {min} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPause(null)}
            disabled={pending || !isPaused}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            Resume now
          </button>
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Weekly schedule
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Times are 24-hour. Customer-app and dispatch read this combined with
              the open/closed override.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-gray-100">
          {DAY_KEYS.map((day) => {
            const v = schedule[day];
            return (
              <li key={day} className="py-3 flex flex-wrap items-center gap-3">
                <div className="w-24 text-sm font-medium text-gray-800">{DAY_LABEL[day]}</div>

                <label className="inline-flex items-center gap-2 cursor-pointer mr-2">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={v.is_open}
                    onChange={(e) => updateDay(day, { is_open: e.target.checked })}
                  />
                  <span className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-brand transition-colors relative">
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${v.is_open ? "translate-x-4" : ""}`} />
                  </span>
                  <span className="text-xs text-gray-600 w-12">{v.is_open ? "Open" : "Closed"}</span>
                </label>

                <input
                  type="time"
                  value={v.open}
                  onChange={(e) => updateDay(day, { open: e.target.value })}
                  disabled={!v.is_open}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="time"
                  value={v.close}
                  onChange={(e) => updateDay(day, { close: e.target.value })}
                  disabled={!v.is_open}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-end gap-3">
          {savedToast && (
            <span className="text-sm text-emerald-700 font-medium">Saved ✓</span>
          )}
          <button
            type="button"
            onClick={onSaveSchedule}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </section>
    </div>
  );
}
