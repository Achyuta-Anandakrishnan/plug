"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { ReferralBar } from "@/components/settings/ReferralBar";
import { ProfileEditor } from "@/components/settings/ProfileEditor";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Settings
        </p>
        <h1 className="font-display text-3xl text-slate-900">Account</h1>
      </div>

      <ReferralBar />

      <div className="surface-panel rounded-[28px] p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Profile
        </p>
        <div className="mt-4">
          <ProfileEditor />
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
            <span>Email</span>
            <span className="font-semibold text-slate-900">
              {session?.user?.email ?? "Not signed in"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
            <span>Role</span>
            <span className="font-semibold text-slate-900">
              {session?.user?.role ?? "Guest"}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {session?.user?.id ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          )}
          <Link
            href="/referral"
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Referral program
          </Link>
        </div>
      </div>
    </div>
  );
}
