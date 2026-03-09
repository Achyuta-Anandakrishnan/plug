"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { ProfileEditor } from "@/components/settings/ProfileEditor";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <h1 className="ios-title">Setting</h1>
      </section>

      <div className="ios-panel p-5">
        <div>
          <ProfileEditor />
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
