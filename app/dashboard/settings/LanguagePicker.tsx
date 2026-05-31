"use client";

import { useState } from "react";

import { setPreferredLanguage } from "./actions";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "./languages";

// Language picker, parity with the native app Settings tab. Writes
// stores.preferred_language on change. Defaults to "en" when the store
// has no preference set yet.
export function LanguagePicker({ current }: { current: string | null }) {
  const initial: LanguageCode =
    current && SUPPORTED_LANGUAGES.some((l) => l.code === current)
      ? (current as LanguageCode)
      : "en";
  const [value, setValue] = useState<LanguageCode>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LanguageCode;
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setPreferredLanguage(next);
      setSaved(true);
    } catch (err) {
      setValue(prev); // revert on failure
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={onChange}
        disabled={busy}
        className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native} ({l.label})
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-700">Saved.</p>}
      <p className="text-[11px] text-gray-400">
        Sets the language for your order emails, notifications, and printed
        kitchen tickets. The portal interface itself is currently available in
        English, French, and Spanish.
      </p>
    </div>
  );
}
