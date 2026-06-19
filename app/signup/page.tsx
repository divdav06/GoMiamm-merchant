"use client";

import Link from "next/link";
import { useState } from "react";

import { signInWithPassword } from "@/lib/auth-client";
import { CUISINES } from "@/lib/cuisines";

import { signUpRestaurant } from "./actions";

// Public self-service merchant registration. Mirrors the visual
// language of /login.
//
// Flow on submit:
//   1. signUpRestaurant server action creates auth user + profile +
//      store + restaurant_users link with rollback on any failure
//   2. signInWithPassword establishes the client-side auth cookie
//   3. window.location.href = "/dashboard" — HARD NAVIGATION on
//      purpose. router.replace("/dashboard") was hitting a stale
//      Router Cache entry for /dashboard (the prefetched/cached RSC
//      payload from before the cookie was set), which threw a client-
//      side exception no error boundary could catch. A plain hard
//      navigation drops the SPA state, refetches with the new cookie,
//      and matches the working anchor-link pattern we verified in the
//      manual-continue debug panel.
//
// The dashboard layout will redirect the freshly-signed-up merchant
// to /dashboard/onboarding because their stores.onboarding_status is
// 'not_started'.
export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !busy &&
    email.trim() !== "" &&
    password.length >= 8 &&
    restaurantName.trim() !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signUpRestaurant({
        email: email.trim(),
        password,
        restaurantName: restaurantName.trim(),
        cuisine: cuisine || null,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      await signInWithPassword(email.trim(), password);
      // Hard navigation — see comment at the top of the file for why
      // we don't use router.replace here.
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white text-2xl font-black mb-4 shadow-sm">
            G
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join GoMiamm</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create your restaurant&apos;s merchant account.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="restaurantName"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Restaurant name
            </label>
            <input
              id="restaurantName"
              type="text"
              autoComplete="organization"
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className={INPUT_CLS}
              placeholder="The Kitchen"
            />
          </div>

          <div>
            <label
              htmlFor="cuisine"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Cuisine <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <select
              id="cuisine"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— Select cuisine —</option>
              {CUISINES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLS}
              placeholder="owner@restaurant.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLS}
              placeholder="At least 8 characters"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              You&apos;ll use this to sign in. Minimum 8 characters.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand text-white font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>

          <div className="text-center text-xs text-gray-500 pt-1">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand hover:text-brand-600"
            >
              Log in
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need help? Contact <span className="text-gray-600">partners@gomiamm.com</span>.
        </p>
      </div>
    </main>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";
