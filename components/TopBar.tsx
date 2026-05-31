"use client";

import { useState } from "react";

import { signOut } from "@/lib/auth-client";

type TopBarProps = {
  storeName: string;
  email: string | null;
};

function initialsFromEmail(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function TopBar({ storeName, email }: TopBarProps) {
  const [busy, setBusy] = useState(false);

  // Clear the Supabase session from the browser side, then bounce
  // through /api/sign-out so the server-side cookies are also dropped
  // and the redirect to /login is the canonical post-logout target.
  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Even if the client signOut fails, the server route will still
      // clear cookies — proceed to the navigation.
    }
    // Hard-navigate so the request hits middleware + clears caches.
    window.location.href = "/api/sign-out";
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3">
        <div className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white text-base font-black shadow-sm">
          G
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Store</div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">{storeName}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-xs text-gray-400">Signed in as</div>
          <div className="text-sm font-medium text-gray-900">{email ?? "—"}</div>
        </div>
        <div
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-white text-sm font-bold shadow-sm"
          aria-hidden="true"
        >
          {initialsFromEmail(email)}
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {busy ? "Signing out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
