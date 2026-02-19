"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function SellerVerificationPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stripeStatus, setStripeStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [stripeMessage, setStripeMessage] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");

  useEffect(() => {
    if (session?.user?.name) setPrefillName(session.user.name);
    if (session?.user?.email) setPrefillEmail(session.user.email);
  }, [session]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      displayName: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      notes: formData.get("notes"),
    };

    try {
      const response = await fetch("/api/sellers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Submission failed");
      }

      setStatus("success");
      setMessage("Application submitted. Our team will reach out within 48 hours.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit right now.");
    }
  };

  const handleConnectStripe = async () => {
    setStripeStatus("loading");
    setStripeMessage("");

    try {
      const response = await fetch("/api/stripe/connect", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Unable to start Stripe onboarding.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setStripeStatus("error");
      setStripeMessage(error instanceof Error ? error.message : "Unable to connect Stripe right now.");
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seller verification</p>
          <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">Get verified to go live.</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            We verify inventory ownership, stream readiness, and fulfillment.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Identity check", detail: "Government ID and selfie match." },
              { title: "Inventory audit", detail: "Proof of ownership and intake photos." },
              { title: "Stream readiness", detail: "Lighting, camera, and mic review." },
              { title: "Payout safety", detail: "Escrow and chargeback controls." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/70 p-4">
                <p className="font-semibold text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-8">
          <h2 className="font-display text-2xl text-slate-900">Verification request</h2>
          <p className="mt-2 text-sm text-slate-600">Share your details and we will review within 48 hours.</p>

          {!session?.user?.id && (
            <button
              onClick={() => signIn()}
              className="mt-4 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Sign in to track your application
            </button>
          )}

          {session?.user?.id && (
            <>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                Signed in as {session.user.email ?? "account"}.
              </div>
              <button
                type="button"
                onClick={handleConnectStripe}
                disabled={stripeStatus === "loading"}
                className="mt-3 w-full rounded-full border border-indigo-300 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 disabled:opacity-60"
              >
                {stripeStatus === "loading" ? "Opening Stripe..." : "Connect Stripe payouts"}
              </button>
              {stripeMessage && (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                  {stripeMessage}
                </div>
              )}
            </>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              name="name"
              type="text"
              required
              placeholder="Business or seller name"
              defaultValue={prefillName}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Contact email"
              defaultValue={prefillEmail}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <input
              name="phone"
              type="tel"
              placeholder="Phone number"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <textarea
              name="notes"
              rows={4}
              placeholder="What will you sell? Add inventory details."
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] disabled:opacity-60"
            >
              {status === "loading" ? "Submitting..." : "Submit verification"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${
                status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
