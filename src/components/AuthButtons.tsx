"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
}

export function AuthButtons() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(
    null,
  );

  useEffect(() => {
    getProviders().then((result) => {
      setProviders(result ?? {});
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
        Checking session...
      </div>
    );
  }

  if (session?.user?.id) {
    const needsSetup = !session.user.username || !session.user.displayName;
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          Signed in as {session.user.email ?? session.user.name ?? "account"}.
        </div>
        {needsSetup ? (
          <Link
            href="/settings?setup=1"
            className="rounded-full bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Complete profile setup
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Sign out
        </button>
      </div>
    );
  }

  const googleAvailable = Boolean(providers?.google);
  const appleAvailable = Boolean(providers?.apple);
  const normalizedUsername = normalizeUsername(username);
  const usernameValid = /^[a-z0-9_]{3,24}$/.test(normalizedUsername);
  const callbackUrl = usernameValid
    ? `/settings?setup=1&username=${encodeURIComponent(normalizedUsername)}`
    : "/settings?setup=1";
  const buttonDisabled = !usernameValid;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Username
        </label>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your_username"
          className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
        <p className="text-[11px] text-slate-500">
          Required. 3-24 chars, lowercase letters, numbers, and underscores.
        </p>
      </div>
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        disabled={!googleAvailable || buttonDisabled}
        className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!googleAvailable ? "Google not configured" : buttonDisabled ? "Enter a valid username" : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => signIn("apple", { callbackUrl })}
        disabled={!appleAvailable || buttonDisabled}
        className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!appleAvailable ? "Apple not configured" : buttonDisabled ? "Enter a valid username" : "Continue with Apple"}
      </button>
    </div>
  );
}
