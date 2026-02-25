"use client";

import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

export default function SignInPage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Welcome back
          </p>
          <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">
            Sign in to continue your live commerce desk.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Access live streams, place offers, and track verification status in
            one secure account.
          </p>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-[var(--royal)]">
              Create an account
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6 sm:p-8">
          <h2 className="font-display text-2xl text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter your username, then use a verified provider to access your account.
          </p>
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
