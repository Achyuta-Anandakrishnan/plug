"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";

type LookupPayload = {
  found?: boolean;
  company?: string | null;
  grade?: string | null;
  label?: string | null;
  title?: string | null;
  year?: string | null;
  brand?: string | null;
  subject?: string | null;
  cardNumber?: string | null;
  category?: string | null;
  variety?: string | null;
  note?: string;
  error?: string;
};

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function buildTitle(cert: string, lookup: LookupPayload) {
  const fromLookup = typeof lookup.title === "string" ? lookup.title.trim() : "";
  if (fromLookup) return fromLookup;
  const parts = [
    lookup.year ?? null,
    lookup.brand ?? null,
    lookup.cardNumber ? `#${lookup.cardNumber}` : null,
    lookup.subject ?? null,
    lookup.variety ?? null,
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  if (parts.length > 0) return parts.join(" ");
  return `${lookup.company ?? "Graded"} cert ${cert}`;
}

function buildDescription(cert: string, lookup: LookupPayload) {
  const lines = [
    lookup.company ? `Company: ${lookup.company}` : null,
    lookup.grade ? `Grade: ${lookup.grade}` : null,
    lookup.label ? `Label: ${lookup.label}` : null,
    lookup.brand ? `Set: ${lookup.brand}` : null,
    lookup.subject ? `Card: ${lookup.subject}` : null,
    lookup.cardNumber ? `Number: ${lookup.cardNumber}` : null,
    lookup.variety ? `Variant: ${lookup.variety}` : null,
    `Cert: ${cert}`,
  ].filter((entry): entry is string => Boolean(entry));
  return lines.join(" • ");
}

export default function NewTradePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [certNumber, setCertNumber] = useState("");
  const [desiredPrice, setDesiredPrice] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookup, setLookup] = useState<LookupPayload | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const cert = certNumber.trim();
    if (cert.length < 4) {
      setLookup(null);
      setLookupMessage("");
      setLookupLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      try {
        const response = await fetchClientApi(`/api/grading/lookup?cert=${encodeURIComponent(cert)}`);
        const payload = (await response.json()) as LookupPayload;
        if (cancelled) return;
        if (!response.ok) {
          setLookup(null);
          setLookupMessage(payload.error || "Unable to verify cert right now.");
          return;
        }
        setLookup(payload);
        setLookupMessage(payload.note || (payload.found ? "Certificate found." : "No certificate match found."));
      } catch {
        if (!cancelled) {
          setLookup(null);
          setLookupMessage("Unable to verify cert right now.");
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [certNumber]);

  const desiredCents = useMemo(() => toCents(desiredPrice), [desiredPrice]);
  const canSubmit = Boolean(session?.user?.id && lookup?.found && desiredCents !== null);
  const previewTitle = useMemo(() => {
    if (!lookup?.found) return "Auto-filled trade title";
    return buildTitle(certNumber.trim(), lookup);
  }, [lookup, certNumber]);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      setError("Sign in to post a trade.");
      return;
    }
    if (!lookup?.found || desiredCents === null) {
      setError("Enter a valid cert number and desired price.");
      return;
    }

    const cert = certNumber.trim();
    const title = buildTitle(cert, lookup);
    const description = buildDescription(cert, lookup);
    const desiredLabel = formatCurrency(desiredCents, "USD");
    const valueMin = Math.max(100, Math.round(desiredCents * 0.85));
    const valueMax = Math.max(valueMin, Math.round(desiredCents * 1.15));

    setSubmitting(true);
    setError("");
    setStatus("");
    try {
      const response = await fetchClientApi("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category: lookup.category ?? "TCG Cards",
          cardSet: lookup.brand ?? null,
          cardNumber: lookup.cardNumber ?? null,
          condition: [lookup.company, lookup.grade].filter(Boolean).join(" ").trim() || "Graded",
          gradeCompany: lookup.company ?? null,
          gradeLabel: lookup.grade ?? null,
          lookingFor: `Trade offers near ${desiredLabel} value.`,
          preferredBrands: lookup.brand ?? null,
          location: null,
          shippingMode: null,
          tags: [lookup.company, lookup.category, "cert"].filter(Boolean),
          valueMin,
          valueMax,
          images: [],
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to create trade post.");
      }
      setStatus("Trade posted.");
      router.push(`/trades/${encodeURIComponent(payload.id)}`);
    } catch (submitError) {
      setError(normalizeClientError(submitError, "Unable to create trade post."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!session?.user?.id) {
    return (
      <div className="ios-panel p-6">
        <h1 className="ios-title">Post trade</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to post a trade.</p>
        <button
          type="button"
          onClick={() => signIn()}
          className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <h1 className="ios-title">Post trade</h1>
        <p className="ios-subtitle">Enter cert number and desired value. Dalow auto-fills the rest.</p>
      </section>

      <section className="surface-panel rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Cert number</p>
            <input
              value={certNumber}
              onChange={(event) => setCertNumber(event.target.value)}
              placeholder="Enter cert number"
              className="ios-input"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Desired value (USD)</p>
            <input
              value={desiredPrice}
              onChange={(event) => setDesiredPrice(event.target.value)}
              inputMode="decimal"
              placeholder="250"
              className="ios-input"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-xs text-slate-600">
            {lookupLoading ? "Checking certificate..." : lookupMessage || "Enter cert number to auto-fill trade details."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</p>
          <p className="mt-2 font-display text-xl text-slate-900">{previewTitle}</p>
          <p className="mt-1 text-sm text-slate-600">
            {(lookup?.company ?? "Grading company")} {lookup?.grade ?? "Grade"} • Cert {certNumber.trim() || "—"}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Desired value: {desiredCents !== null ? formatCurrency(desiredCents, "USD") : "—"}
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {status ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {status}
        </div>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/trades"
          className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
          className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post trade"}
        </button>
      </section>
    </div>
  );
}
