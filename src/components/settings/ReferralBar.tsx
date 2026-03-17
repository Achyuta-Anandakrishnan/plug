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
    <section className="product-card referral-panel">
      <div className="referral-panel-copy">
        <p className="app-eyebrow">Referral link</p>
        <p className="referral-panel-note">
          {link ? "Share this private signup link with trusted collectors." : "Sign in to generate your referral link."}
        </p>
      </div>

      <div className="referral-panel-row">
        <input
          value={link}
          readOnly
          placeholder="Referral link"
          className="app-form-input"
        />
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!link}
          className="app-button app-button-primary referral-copy-button"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
