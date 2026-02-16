"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";

function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export function ReferralBar() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    const origin = getOrigin();
    const id = session?.user?.id;
    if (!origin || !id) return "";
    // This app doesn't yet implement referral-code redemption; this is a stable identifier for now.
    return `${origin}/signup?ref=${encodeURIComponent(id)}`;
  }, [session?.user?.id]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="surface-panel rounded-[28px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Referral link
          </p>
          <p className="text-sm text-slate-600">
            Invite trusted sellers. Earn priority perks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!link}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
        {link || "Sign in to generate your referral link."}
      </div>
    </div>
  );
}

