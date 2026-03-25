"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/format";

type ListingType = "AUCTION" | "BUY_NOW" | "BOTH";
type CertGrader = "PSA" | "CDC" | "BGS" | "BVG";

type VerifyPayload = {
  found?: boolean;
  grader?: string;
  certNumber?: string;
  verificationStatus?: "verified" | "not_found";
  provider?: string;
  player?: string | null;
  year?: string | null;
  brand?: string | null;
  set?: string | null;
  cardNumber?: string | null;
  grade?: string | null;
  title?: string | null;
  images?: { front?: string | null; back?: string | null } | string[];
  imageUrl?: string | null;
  imageUrls?: string[];
  label?: string | null;
  subject?: string | null;
  category?: string | null;
  variety?: string | null;
  note?: string;
  error?: string;
};

const listingTypes: Array<{ value: ListingType; label: string }> = [
  { value: "AUCTION", label: "Auction" },
  { value: "BUY_NOW", label: "Buy now" },
  { value: "BOTH", label: "Auction + buy now" },
];

const certGraders: Array<{ value: CertGrader; label: string }> = [
  { value: "PSA", label: "PSA" },
  { value: "CDC", label: "CDC" },
  { value: "BGS", label: "BGS" },
  { value: "BVG", label: "BVG" },
];

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function uniqueImageUrls(values: Array<string | null | undefined>) {
  const deduped = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) continue;
    deduped.add(trimmed);
  }
  return Array.from(deduped).slice(0, 8);
}

function getImageUrls(payload: VerifyPayload | null) {
  if (!payload) return [];
  const list = Array.isArray(payload.imageUrls) ? payload.imageUrls : [];

  const fromImages = Array.isArray(payload.images)
    ? payload.images.filter((entry): entry is string => typeof entry === "string")
    : [payload.images?.front ?? null, payload.images?.back ?? null];

  return uniqueImageUrls([payload.imageUrl ?? null, ...list, ...fromImages]);
}

function buildTitle(cert: string, payload: VerifyPayload) {
  const explicit = typeof payload.title === "string" ? payload.title.trim() : "";
  if (explicit) return explicit;

  const parts = [
    payload.year ?? null,
    payload.brand ?? payload.set ?? null,
    payload.cardNumber ? `#${payload.cardNumber}` : null,
    payload.player ?? payload.subject ?? null,
    payload.variety ?? null,
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));

  if (parts.length > 0) return parts.join(" ");
  return `${payload.grader ?? "Graded"} cert ${cert}`;
}

function buildDescription(cert: string, payload: VerifyPayload) {
  const lines = [
    payload.grader ? `Company: ${payload.grader}` : null,
    payload.grade ? `Grade: ${payload.grade}` : null,
    payload.label ? `Label: ${payload.label}` : null,
    payload.category ? `Category: ${payload.category}` : null,
    payload.brand ? `Brand: ${payload.brand}` : null,
    payload.set ? `Set: ${payload.set}` : null,
    payload.player ? `Player: ${payload.player}` : null,
    payload.cardNumber ? `Card #: ${payload.cardNumber}` : null,
    payload.variety ? `Variety: ${payload.variety}` : null,
    `Cert: ${cert}`,
  ].filter((entry): entry is string => Boolean(entry));
  return lines.join(" • ");
}

function infoLine(label: string, value: string | null | undefined) {
  return {
    label,
    value: value && value.trim().length > 0 ? value : "-",
  };
}

export function SellerListingQuickForm() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isSeller = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const [listingType, setListingType] = useState<ListingType>("AUCTION");
  const [grader, setGrader] = useState<CertGrader>("PSA");
  const [certNumber, setCertNumber] = useState("");
  const [desiredPrice, setDesiredPrice] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookup, setLookup] = useState<VerifyPayload | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [listingId, setListingId] = useState("");

  useEffect(() => {
    const cert = certNumber.replace(/\s+/g, "").trim();
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
        const requestGrader = grader === "CDC" ? "CGC" : grader;
        const response = await fetch("/api/verify-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grader: requestGrader, certNumber: cert }),
        });

        const payload = (await response.json()) as VerifyPayload;
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
  }, [certNumber, grader]);

  const desiredCents = useMemo(() => toCents(desiredPrice), [desiredPrice]);
  const cert = certNumber.replace(/\s+/g, "").trim();
  const canSubmit = Boolean(isSeller && cert.length >= 4 && desiredCents !== null && lookup?.found);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "AUCTION" || mode === "BUY_NOW" || mode === "BOTH") {
      setListingType(mode);
    }
    const cert = searchParams.get("cert")?.trim() ?? "";
    const price = searchParams.get("price")?.trim() ?? "";
    const grader = searchParams.get("grader")?.trim().toUpperCase() ?? "";

    if (cert) {
      setCertNumber((current) => current || cert);
    }
    if (price) {
      setDesiredPrice((current) => current || price);
    }
    if (grader === "PSA" || grader === "CDC" || grader === "BGS" || grader === "BVG") {
      setGrader(grader);
    }
  }, [searchParams]);

  const previewTitle = useMemo(() => {
    if (!lookup || !lookup.found) return "Auto-filled title";
    return buildTitle(cert, lookup);
  }, [lookup, cert]);

  const certImages = useMemo(() => getImageUrls(lookup), [lookup]);
  const previewRows = useMemo(() => {
    return [
      infoLine("Verification", lookup?.verificationStatus ?? (lookup?.found ? "verified" : null)),
      infoLine("Provider", lookup?.provider ?? lookup?.grader?.toLowerCase()),
      infoLine("Grader", lookup?.grader),
      infoLine("Cert", cert || null),
      infoLine("Player", lookup?.player ?? lookup?.subject),
      infoLine("Year", lookup?.year),
      infoLine("Brand", lookup?.brand),
      infoLine("Set", lookup?.set ?? lookup?.brand),
      infoLine("Card #", lookup?.cardNumber),
      infoLine("Grade", lookup?.grade),
    ];
  }, [lookup, cert]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !lookup || !lookup.found || desiredCents === null) {
      setStatus("error");
      setSubmitMessage("Enter a valid cert number and desired price.");
      return;
    }

    setStatus("loading");
    setSubmitMessage("");

    const title = buildTitle(cert, lookup);
    const description = buildDescription(cert, lookup);
    const condition = [lookup.grader, lookup.grade].filter(Boolean).join(" ").trim() || "Graded";
    const listingMode = listingType;
    const effectiveListingType = listingMode;
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
          gradingCompany: lookup.grader ?? null,
          gradingLabel: lookup.label ?? null,
          grade: lookup.grade ?? null,
          certNumber: cert,
          verificationStatus: lookup.verificationStatus ?? (lookup.found ? "verified" : "not_found"),
          provider: lookup.provider ?? lookup.grader?.toLowerCase() ?? null,
          year: lookup.year ?? null,
          brand: lookup.brand ?? null,
          set: lookup.set ?? lookup.brand ?? null,
          subject: lookup.subject ?? lookup.player ?? null,
          player: lookup.player ?? lookup.subject ?? null,
          cardNumber: lookup.cardNumber ?? null,
          category: lookup.category ?? null,
          variety: lookup.variety ?? null,
          listingMode,
          autoFilledFromCert: true,
        },
      },
      images: certImages.map((url, index) => ({
        url,
        isPrimary: index === 0,
      })),
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
    <form onSubmit={handleSubmit} className="sell-form-panel sell-quick-form">
      <div className="sell-quick-head">
        <div>
          <p className="app-eyebrow">Fast lane</p>
          <h2>Create a verified listing from the cert.</h2>
        </div>
        <div className="sell-quick-price">
          <span>Preview ask</span>
          <strong>{desiredCents !== null ? formatCurrency(desiredCents, "USD") : "Set price"}</strong>
        </div>
      </div>
      {isSeller ? null : (
        <div className="sell-alert-stack">
          <p className="app-status-note is-warning">
            {session?.user?.id
              ? "Your account is not a seller yet. Submit seller verification for manual review."
              : "Sign in to publish listings."}
          </p>
          {!session?.user?.id ? (
            <button type="button" onClick={() => signIn()} className="app-button app-button-primary">
              Sign in
            </button>
          ) : null}
        </div>
      )}

      <section className="listing-form-stage">
        <div className="listing-form-stage-head">
          <div>
            <p className="app-eyebrow">Step 1</p>
            <h3>Verify item</h3>
          </div>
          <p>Look up the cert, confirm the grader, and set the target ask.</p>
        </div>

        <div className="listing-form-stage-grid">
          <div className="sell-field-group">
            <p className="app-eyebrow">Grader</p>
            <select
              value={grader}
              onChange={(event) => setGrader(event.target.value as CertGrader)}
              className="app-form-input"
            >
              {certGraders.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sell-field-group">
            <p className="app-eyebrow">Cert number</p>
            <input
              value={certNumber}
              onChange={(event) => setCertNumber(event.target.value)}
              placeholder="Enter cert number"
              className="app-form-input"
            />
          </div>
          <div className="sell-field-group">
            <p className="app-eyebrow">Desired price (USD)</p>
            <input
              value={desiredPrice}
              onChange={(event) => setDesiredPrice(event.target.value)}
              inputMode="decimal"
              placeholder="250"
              className="app-form-input"
            />
          </div>
        </div>

        <div className="sell-quick-lookup">
          <p className="text-xs text-slate-600">
            {lookupLoading ? "Checking certificate..." : lookupMessage || "Enter cert number to auto-fill listing details."}
          </p>
        </div>
      </section>

      <section className="listing-form-stage">
        <div className="listing-form-stage-head">
          <div>
            <p className="app-eyebrow">Step 2</p>
            <h3>Choose listing type</h3>
          </div>
          <p>Pick the mode that matches how you want the item to move.</p>
        </div>

        <div className="sell-type-grid">
          {listingTypes.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setListingType(entry.value)}
              className={`app-chip${listingType === entry.value ? " is-active" : ""}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="listing-form-stage sell-quick-preview">
        <div className="listing-form-stage-head">
          <div>
            <p className="app-eyebrow">Step 3</p>
            <h3>Review preview</h3>
          </div>
          <p>Make sure the title, cert details, and images look clean before publishing.</p>
        </div>

        {certImages.length > 0 ? (
          <div className="cert-preview-grid sell-cert-preview-grid">
            {certImages.slice(0, 2).map((url, index) => (
              <div key={`${url}-${index}`} className="cert-preview-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={index === 0 ? "Cert front" : "Cert back"}
                  className="cert-preview-image"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <p className="sell-preview-title">{previewTitle}</p>
          <p className="sell-preview-subtitle">
            {(lookup?.grader ?? "Grading company")} {lookup?.grade ?? "Grade"} • Cert {cert || "-"}
          </p>
          <p className="sell-preview-note">
            Desired price: {desiredCents !== null ? formatCurrency(desiredCents, "USD") : "Enter desired price"}
          </p>
        </div>

        <div className="sell-quick-rows-grid">
          {previewRows.map((row) => (
            <div key={row.label} className="sell-quick-row">
              <p className="app-eyebrow">{row.label}</p>
              <p className="sell-quick-row-value">{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      {submitMessage ? (
        <p className={`app-status-note${status === "success" ? " is-success" : status === "error" ? " is-error" : ""}`}>
          {submitMessage}
          {status === "success" && listingId ? (
            <Link href={`/streams/${listingId}`} className="app-link"> Open listing</Link>
          ) : null}
        </p>
      ) : null}

      <div className="sell-quick-actions listing-form-publish">
        <div className="listing-form-stage-head">
          <div>
            <p className="app-eyebrow">Step 4</p>
            <h3>Publish listing</h3>
          </div>
          <p>We only publish once the cert resolves cleanly and the listing details are ready.</p>
        </div>
        <button
          type="submit"
          disabled={!canSubmit || status === "loading"}
          className="app-button app-button-primary sell-submit-btn"
        >
          {status === "loading" ? "Creating..." : "Create listing"}
        </button>
        <p className="sell-quick-help">
          Auction pricing auto-builds from your ask. We publish only once the cert resolves cleanly.
        </p>
      </div>
    </form>
  );
}
