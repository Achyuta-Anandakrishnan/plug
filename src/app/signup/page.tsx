"use client";

import { useState } from "react";
import { AuthButtons } from "@/components/AuthButtons";

export default function SignupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Buyer");
  const [category, setCategory] = useState("Pokemon");
  const [referral, setReferral] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const displayName = `${firstName} ${lastName}`.trim();
    const payload = {
      email,
      phone,
      displayName: displayName || undefined,
      role: role.toUpperCase() as "BUYER" | "SELLER" | "BOTH",
      applyAsSeller: role !== "Buyer",
      category,
      referral,
    };

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create account.");
      }
      setStatus("success");
      setMessage("Account created. You can now browse or apply as seller.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("Buyer");
      setCategory("Pokemon");
      setReferral("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create account.");
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Create account
          </p>
          <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">
            Join the most trusted live stream sales network.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Every buyer is protected by escrow and verification logs. Sellers go
            through manual review before they can broadcast.
          </p>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Escrow protection</span>
              <span className="text-xs font-semibold text-slate-800">Built-in</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Seller vetting</span>
              <span className="text-xs font-semibold text-slate-800">Manual</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
              <span>Secure messaging</span>
              <span className="text-xs font-semibold text-slate-800">Logged</span>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6 sm:p-8">
          <h2 className="font-display text-2xl text-slate-900">Sign up</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick your role and complete the trust profile.
          </p>
          <div className="mt-6">
            <AuthButtons />
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            Or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              />
            </div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              required
            />
            <input
              type="tel"
              placeholder="Mobile number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              >
                <option>Buyer</option>
                <option>Seller</option>
                <option>Both</option>
              </select>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
              >
                <option>Pokemon</option>
                <option>Electronics</option>
                <option>Sneakers</option>
                <option>Luxury</option>
                <option>Collectibles</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Referral code (optional)"
              value={referral}
              onChange={(event) => setReferral(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-xs text-slate-600">
              <input type="checkbox" className="mt-1" />
              I agree to the buyer protection policy and terms of service.
            </label>
            <button
              className="w-full rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] disabled:opacity-60"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Creating..." : "Create account"}
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
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-xs text-slate-500">
            Sellers will be asked to upload ID and inventory proof after signup.
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[32px] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Trust stack
            </p>
            <h2 className="font-display text-2xl text-slate-900">
              Verify once, unlock premium access.
            </h2>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            Average review 48 hours
          </span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Identity check",
              detail: "Government ID and selfie match.",
            },
            {
              title: "Inventory audit",
              detail: "Proof of ownership and intake photos.",
            },
            {
              title: "Stream readiness",
              detail: "Live onboarding and camera quality test.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/70 bg-white/70 p-5"
            >
              <p className="font-display text-lg text-slate-900">
                {item.title}
              </p>
              <p className="text-sm text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
