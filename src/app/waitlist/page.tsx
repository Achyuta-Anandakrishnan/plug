"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Something went wrong. Try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="waitlist-page">
      <div className="waitlist-bg" aria-hidden="true">
        <div className="waitlist-bg-orb waitlist-bg-orb-1" />
        <div className="waitlist-bg-orb waitlist-bg-orb-2" />
        <div className="waitlist-bg-orb waitlist-bg-orb-3" />
      </div>

      <div className="waitlist-shell">
        <Link href="/" className="waitlist-brand" aria-label="dalow home">
          <Image
            src="/dalow-logo.svg"
            alt="dalow"
            width={48}
            height={48}
            className="waitlist-brand-mark"
            priority
          />
        </Link>

        <div className="waitlist-card">
          {status === "success" ? (
            <div className="waitlist-success">
              <div className="waitlist-success-icon" aria-hidden="true">✓</div>
              <h2>You&rsquo;re on the list.</h2>
              <p>We&rsquo;ll reach out when dalow opens to collectors. Keep an eye on your inbox.</p>
              <Link href="/" className="waitlist-back-link">← Back to home</Link>
            </div>
          ) : (
            <>
              <div className="waitlist-card-header">
                <p className="waitlist-eyebrow">Early access</p>
                <h1>Join the waitlist.</h1>
                <p className="waitlist-subtitle">
                  dalow is a premium collectibles platform for live streams, structured auctions, direct trades, and demand-led bounties.
                  <br />
                  Be the first to get access.
                </p>
              </div>

              <form className="waitlist-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
                <div className="waitlist-field">
                  <label className="waitlist-label" htmlFor="wl-name">
                    Name <span className="waitlist-optional">(optional)</span>
                  </label>
                  <input
                    id="wl-name"
                    type="text"
                    className="waitlist-input"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={status === "loading"}
                    autoComplete="name"
                  />
                </div>

                <div className="waitlist-field">
                  <label className="waitlist-label" htmlFor="wl-email">
                    Email address
                  </label>
                  <input
                    id="wl-email"
                    type="email"
                    className="waitlist-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === "loading"}
                    autoComplete="email"
                  />
                </div>

                {status === "error" && (
                  <p className="waitlist-error" role="alert">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  className="waitlist-submit"
                  disabled={status === "loading" || !email.trim()}
                >
                  {status === "loading" ? "Joining…" : "Join waitlist →"}
                </button>
              </form>

              <p className="waitlist-fine-print">
                No spam. We&rsquo;ll only email you when access opens.
              </p>
            </>
          )}
        </div>

        <div className="waitlist-trust-row">
          <span className="waitlist-trust-chip">Live streams</span>
          <span className="waitlist-trust-chip">Live auctions</span>
          <span className="waitlist-trust-chip">Collector trades</span>
          <span className="waitlist-trust-chip">Demand bounties</span>
        </div>
      </div>
    </div>
  );
}
