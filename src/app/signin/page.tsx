"use client";

import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

export default function SignInPage() {
  return (
    <div className="ios-screen">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <p className="ios-kicker">
            Welcome back
          </p>
          <h1 className="ios-title">
            Sign in.
          </h1>
          <p className="ios-subtitle">
            Streams, listings, messages.
          </p>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-[var(--royal)]">
              Create an account
            </Link>
          </div>
        </div>

        <div className="ios-panel p-6 sm:p-8">
          <h2 className="font-display text-3xl text-slate-900">Sign in</h2>
          <div className="mt-6">
            <AuthButtons />
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-xs text-slate-500">
            After sign-in, complete your profile with username and bio in settings.
          </div>
        </div>
      </section>
    </div>
  );
}
