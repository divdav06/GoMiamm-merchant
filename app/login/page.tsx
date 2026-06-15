"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { signInWithPassword } from "@/lib/auth-client";

const ERROR_COPY: Record<string, string> = {
  not_partner: "That account isn't a GoMiamm partner. Contact your account manager if this is unexpected.",
};

// useSearchParams() forces this subtree to client-render, so it must
// sit under a Suspense boundary or `next build` fails the /login
// prerender. The default export provides that boundary.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const queryError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(queryError ? ERROR_COPY[queryError] ?? queryError : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      // HARD NAVIGATION on purpose — mirrors app/signup/page.tsx.
      // router.replace("/dashboard") applied a stale Router Cache RSC
      // payload for /dashboard prefetched before the auth cookie was
      // set (a redirect-to-/login from the middleware gate). That throw
      // happens inside Next's internal navigation machinery, so the
      // catch below never fired, busy was never reset, and the button
      // hung on "Signing in…" forever. A hard navigation drops SPA
      // state and refetches /dashboard with the new cookie. The
      // middleware/dashboard gate then routes by restaurant_users +
      // onboarding_status / is_approved.
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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
          <h1 className="text-2xl font-bold text-gray-900">GoMiamm Merchant</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to manage your restaurant.</p>
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
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              placeholder="owner@restaurant.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-brand text-white font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="text-center text-xs text-gray-500 pt-1">
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-brand hover:text-brand-600"
            >
              Create an account
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
