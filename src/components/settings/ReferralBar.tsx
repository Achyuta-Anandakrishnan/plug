"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

type ReferralSummary = {
  code: string;
  referrals: Array<{
    id: string;
    referredEmail: string;
    status: string;
    createdAt: string;
  }>;
};

function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export function ReferralBar() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const activeSummary = session?.user?.id ? summary : null;
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    if (!session?.user?.id) return;

    let cancelled = false;
    void fetch("/api/referrals", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<ReferralSummary>;
      })
      .then((payload) => {
        if (!cancelled && payload) setSummary(payload);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const link = useMemo(() => {
    const origin = getOrigin();
    const code = activeSummary?.code ?? session?.user?.username ?? session?.user?.id;
    if (!origin || !code) return "";
    return `${origin}/signup?ref=${encodeURIComponent(code)}`;
  }, [activeSummary?.code, session?.user?.id, session?.user?.username]);

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

  async function share() {
    if (!link || typeof navigator === "undefined" || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "dalow referral link",
        text: "Join me on dalow.",
        url: link,
      });
      setShared(true);
      window.setTimeout(() => setShared(false), 1400);
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
        {activeSummary?.referrals?.length ? (
          <p className="referral-panel-note">
            {activeSummary.referrals.filter((entry) => entry.status === "APPLIED").length} applied · {activeSummary.referrals.filter((entry) => entry.status === "APPROVED").length} approved
          </p>
        ) : null}
      </div>

      <div className="referral-panel-row">
        <input
          value={link}
          readOnly
          placeholder="Referral link"
          className="app-form-input"
        />
        <div className="referral-panel-actions">
          {canShare ? (
            <button
              type="button"
              onClick={() => void share()}
              disabled={!link}
              className="app-button app-button-secondary referral-share-button"
            >
              {shared ? "Shared" : "Share"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!link}
            className="app-button app-button-primary referral-copy-button"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </section>
  );
}
