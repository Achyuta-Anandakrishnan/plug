"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

export function AuthButtons() {
  const { data: session, status } = useSession();
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
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          Signed in as {session.user.email ?? session.user.name ?? "account"}.
        </div>
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

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={!googleAvailable}
        className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {googleAvailable ? "Continue with Google" : "Google not configured"}
      </button>
      <button
        type="button"
        onClick={() => signIn("apple")}
        disabled={!appleAvailable}
        className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {appleAvailable ? "Continue with Apple" : "Apple not configured"}
      </button>
    </div>
  );
}
