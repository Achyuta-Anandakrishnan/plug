"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/format";

type ListingType = "AUCTION" | "BUY_NOW" | "BOTH" | "LIVE_STREAM";

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

const listingTypes: Array<{ value: ListingType; label: string }> = [
  { value: "AUCTION", label: "Auction" },
  { value: "BUY_NOW", label: "Buy now" },
  { value: "BOTH", label: "Auction + buy now" },
  { value: "LIVE_STREAM", label: "Live stream" },
];

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
    lookup.category ? `Category: ${lookup.category}` : null,
    lookup.brand ? `Set: ${lookup.brand}` : null,
    lookup.subject ? `Card: ${lookup.subject}` : null,
    lookup.cardNumber ? `Number: ${lookup.cardNumber}` : null,
    lookup.variety ? `Variant: ${lookup.variety}` : null,
    `Cert: ${cert}`,
  ].filter((entry): entry is string => Boolean(entry));
  return lines.join(" • ");
}

export function SellerListingQuickForm() {
  const { data: session } = useSession();
  const isSeller = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const [listingType, setListingType] = useState<ListingType>("AUCTION");
  const [certNumber, setCertNumber] = useState("");
  const [desiredPrice, setDesiredPrice] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookup, setLookup] = useState<LookupPayload | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [listingId, setListingId] = useState("");

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
        const response = await fetch(`/api/grading/lookup?cert=${encodeURIComponent(cert)}`);
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
  const canSubmit = Boolean(
    isSeller
      && certNumber.trim().length >= 4
      && desiredCents !== null
      && lookup?.found,
  );

  const previewTitle = useMemo(() => {
    if (!lookup || !lookup.found) return "Auto-filled title";
    return buildTitle(certNumber.trim(), lookup);
  }, [lookup, certNumber]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !lookup || !lookup.found || desiredCents === null) {
      setStatus("error");
      setSubmitMessage("Enter a valid cert number and desired price.");
      return;
    }

    setStatus("loading");
    setSubmitMessage("");

    const cert = certNumber.trim();
    const title = buildTitle(cert, lookup);
    const description = buildDescription(cert, lookup);
    const condition = [lookup.company, lookup.grade].filter(Boolean).join(" ").trim() || "Graded";
    const listingMode = listingType;
    const effectiveListingType = listingMode === "LIVE_STREAM" ? "AUCTION" : listingMode;
    const auctionStart = effectiveListingType === "BOTH"
      ? Math.max(100, Math.round(desiredCents * 0.85))
      : desiredCents;
    const minIncrement = Math.max(100, Math.round(auctionStart * 0.05));

    const payload = {
      listingType: listingMode,
      title,
      description,
      startingBid: effectiveListingType !== "BUY_NOW" ? auctionStart : undefined,
      buyNowPrice: effectiveListingType !== "AUCTION" ? desiredCents : undefined,
      minBidIncrement: effectiveListingType !== "BUY_NOW" ? minIncrement : undefined,
      publishNow: true,
      currency: "usd",
      item: {
        title,
        description,
        condition,
        attributes: {
          isGraded: true,
          gradingCompany: lookup.company ?? null,
          gradingLabel: lookup.label ?? null,
          grade: lookup.grade ?? null,
          certNumber: cert,
          year: lookup.year ?? null,
          brand: lookup.brand ?? null,
          subject: lookup.subject ?? null,
          cardNumber: lookup.cardNumber ?? null,
          category: lookup.category ?? null,
          variety: lookup.variety ?? null,
          listingMode,
          autoFilledFromCert: true,
        },
      },
      images: [],
    };

    try {
      const response = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || "Unable to create listing.");
      }
      setListingId(data.id);
      setStatus("success");
      setSubmitMessage("Listing created.");
    } catch (error) {
      setStatus("error");
      setSubmitMessage(error instanceof Error ? error.message : "Unable to create listing.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface-panel rounded-3xl p-4 sm:p-5 space-y-4">
      {isSeller ? null : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {session?.user?.id
            ? "Your account is not a seller yet. Submit seller verification for manual review."
            : "Sign in to publish listings."}
          {!session?.user?.id ? (
            <button
              type="button"
              onClick={() => signIn()}
              className="ml-3 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
            >
              Sign in
            </button>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Desired price (USD)</p>
          <input
            value={desiredPrice}
            onChange={(event) => setDesiredPrice(event.target.value)}
            inputMode="decimal"
            placeholder="250"
            className="ios-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Listing mode</p>
        <div className="flex flex-wrap gap-2">
          {listingTypes.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setListingType(entry.value)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                listingType === entry.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
        <p className="text-xs text-slate-600">
          {lookupLoading ? "Checking certificate..." : lookupMessage || "Enter cert number to auto-fill listing details."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</p>
        <p className="mt-2 font-display text-xl text-slate-900">{previewTitle}</p>
        <p className="mt-1 text-sm text-slate-600">
          {(lookup?.company ?? "Grading company")} {lookup?.grade ?? "Grade"} • Cert {certNumber.trim() || "—"}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Desired price: {desiredCents !== null ? formatCurrency(desiredCents, "USD") : "—"}
        </p>
      </div>

      {submitMessage ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            status === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : status === "error"
                ? "border border-red-200 bg-red-50 text-red-600"
                : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          {submitMessage}
          {status === "success" && listingId ? (
            <Link href={`/streams/${listingId}`} className="ml-2 font-semibold text-[var(--royal)]">
              Open listing
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || status === "loading"}
        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50"
      >
        {status === "loading" ? "Creating..." : "Create listing"}
      </button>
    </form>
  );
}
