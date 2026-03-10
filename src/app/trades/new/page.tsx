"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";

type VerifyCardPayload = {
  found?: boolean;
  grader?: string;
  certNumber?: string;
  title?: string | null;
  grade?: string | null;
  label?: string | null;
  year?: string | null;
  brand?: string | null;
  subject?: string | null;
  cardNumber?: string | null;
  category?: string | null;
  variety?: string | null;
  imageUrl?: string | null;
  images?: string[];
  note?: string;
  source?: "PSA_PUBLIC_API" | "LOOKUP_FALLBACK";
  cached?: boolean;
  error?: string;
};

type ManualDraft = {
  title: string;
  lookingFor: string;
  description: string;
  category: string;
  cardSet: string;
  cardNumber: string;
  condition: string;
  gradeCompany: string;
  gradeLabel: string;
  tags: string;
};

const manualDefaults: ManualDraft = {
  title: "",
  lookingFor: "",
  description: "",
  category: "TCG Cards",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradeCompany: "",
  gradeLabel: "",
  tags: "",
};

function toCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function toTagList(input: string, autoTags: string[] = []) {
  const manual = input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set([...autoTags, ...manual]));
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

function buildTitle(cert: string, card: VerifyCardPayload | null) {
  if (!card) return `Cert ${cert}`;
  const provided = typeof card.title === "string" ? card.title.trim() : "";
  if (provided) return provided;
  const parts = [
    card.year ?? null,
    card.brand ?? null,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.subject ?? null,
    card.variety ?? null,
  ].filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  if (parts.length > 0) return parts.join(" ");
  return `${card.grader ?? "Graded"} cert ${cert}`;
}

function buildDescription(cert: string, card: VerifyCardPayload | null) {
  if (!card) return `Cert: ${cert}`;
  const lines = [
    card.grader ? `Company: ${card.grader}` : null,
    card.grade ? `Grade: ${card.grade}` : null,
    card.label ? `Label: ${card.label}` : null,
    card.brand ? `Set: ${card.brand}` : null,
    card.subject ? `Card: ${card.subject}` : null,
    card.cardNumber ? `Number: ${card.cardNumber}` : null,
    card.variety ? `Variant: ${card.variety}` : null,
    `Cert: ${cert}`,
  ].filter((entry): entry is string => Boolean(entry));
  return lines.join(" • ");
}

export default function NewTradePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [manualMode, setManualMode] = useState(false);

  const [grader] = useState("AUTO");
  const [certNumber, setCertNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedCard, setVerifiedCard] = useState<VerifyCardPayload | null>(null);
  const [verifyNote, setVerifyNote] = useState("");

  const [desiredPrice, setDesiredPrice] = useState("");
  const [manualDraft, setManualDraft] = useState<ManualDraft>(manualDefaults);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const desiredCents = useMemo(() => toCents(desiredPrice), [desiredPrice]);
  const cert = certNumber.replace(/\s+/g, "").trim();

  const autoTitle = useMemo(
    () => buildTitle(cert || "cert", verifiedCard),
    [cert, verifiedCard],
  );

  const verifyCard = async () => {
    if (!cert || cert.length < 4) {
      setError("Enter a valid cert number.");
      return;
    }

    setVerifyLoading(true);
    setError("");
    setStatus("");

    try {
      const response = await fetchClientApi("/api/verify-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grader, certNumber: cert }),
      });
      const payload = (await response.json()) as VerifyCardPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Unable to verify cert.");
      }

      setVerifiedCard(payload);
      setVerifyNote(payload.note || "Lookup complete.");

      setManualDraft((prev) => ({
        ...prev,
        title: prev.title || buildTitle(cert, payload),
        lookingFor: prev.lookingFor || "Trade offers",
        description: prev.description || buildDescription(cert, payload),
        category: payload.category || prev.category,
        cardSet: payload.brand || prev.cardSet,
        cardNumber: payload.cardNumber || prev.cardNumber,
        condition: prev.condition || [payload.grader, payload.grade].filter(Boolean).join(" ").trim(),
        gradeCompany: payload.grader || prev.gradeCompany,
        gradeLabel: payload.grade || prev.gradeLabel,
      }));

      if (payload.found) {
        setManualMode(false);
        setStep(2);
        setStatus(payload.cached ? "Card verified (cached)." : "Card verified.");
      } else {
        setManualMode(true);
        setStep(1);
        setError(payload.note || "Cert not found. Use manual fallback form.");
      }
    } catch (verifyError) {
      setManualMode(true);
      setStep(1);
      setError(normalizeClientError(verifyError, "Unable to verify cert."));
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitAutoTrade = async () => {
    if (!session?.user?.id) {
      setError("Sign in to post a trade.");
      return;
    }
    if (!verifiedCard?.found || desiredCents === null) {
      setError("Verify cert and enter a valid price.");
      return;
    }

    const title = buildTitle(cert, verifiedCard);
    const description = buildDescription(cert, verifiedCard);
    const desiredLabel = formatCurrency(desiredCents, "USD");
    const valueMin = Math.max(100, Math.round(desiredCents * 0.85));
    const valueMax = Math.max(valueMin, Math.round(desiredCents * 1.15));
    const tags = [verifiedCard.grader, verifiedCard.category, "cert"].filter((entry): entry is string => Boolean(entry));

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
          category: verifiedCard.category ?? "TCG Cards",
          cardSet: verifiedCard.brand ?? null,
          cardNumber: verifiedCard.cardNumber ?? null,
          condition: [verifiedCard.grader, verifiedCard.grade].filter(Boolean).join(" ").trim() || "Graded",
          gradeCompany: verifiedCard.grader ?? null,
          gradeLabel: verifiedCard.grade ?? null,
          lookingFor: `Trade offers near ${desiredLabel}.`,
          preferredBrands: verifiedCard.brand ?? null,
          location: null,
          shippingMode: null,
          tags,
          valueMin,
          valueMax,
          images: uniqueImageUrls([verifiedCard.imageUrl, ...(verifiedCard.images ?? [])]).map((url, index) => ({
            url,
            isPrimary: index === 0,
          })),
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

  const submitManualTrade = async () => {
    if (!session?.user?.id) {
      setError("Sign in to post a trade.");
      return;
    }

    const title = manualDraft.title.trim();
    const lookingFor = manualDraft.lookingFor.trim();
    if (!title || !lookingFor) {
      setError("Manual fallback requires title and looking-for details.");
      return;
    }

    const valueMin = desiredCents !== null ? Math.max(100, Math.round(desiredCents * 0.85)) : null;
    const valueMax = desiredCents !== null && valueMin !== null
      ? Math.max(valueMin, Math.round(desiredCents * 1.15))
      : null;

    setSubmitting(true);
    setError("");
    setStatus("");

    try {
      const response = await fetchClientApi("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: manualDraft.description.trim() || null,
          category: manualDraft.category.trim() || null,
          cardSet: manualDraft.cardSet.trim() || null,
          cardNumber: manualDraft.cardNumber.trim() || null,
          condition: manualDraft.condition.trim() || null,
          gradeCompany: manualDraft.gradeCompany.trim() || null,
          gradeLabel: manualDraft.gradeLabel.trim() || null,
          lookingFor,
          preferredBrands: manualDraft.cardSet.trim() || null,
          location: null,
          shippingMode: null,
          tags: toTagList(manualDraft.tags, [manualDraft.gradeCompany, manualDraft.category].filter(Boolean)),
          valueMin,
          valueMax,
          images: uniqueImageUrls([verifiedCard?.imageUrl, ...(verifiedCard?.images ?? [])]).map((url, index) => ({
            url,
            isPrimary: index === 0,
          })),
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
        <p className="ios-subtitle">Step 1 verify cert. Step 2 set price. Step 3 review and post.</p>
      </section>

      <section className="surface-panel rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="ios-chip-row">
          <span className={`ios-chip ${step === 1 ? "ios-chip-active" : ""}`}>1. Cert</span>
          <span className={`ios-chip ${step === 2 ? "ios-chip-active" : ""}`}>2. Price</span>
          <span className={`ios-chip ${step === 3 ? "ios-chip-active" : ""}`}>3. Review</span>
        </div>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={certNumber}
              onChange={(event) => setCertNumber(event.target.value)}
              placeholder="Cert number"
              className="ios-input"
            />
            <button
              type="button"
              onClick={() => void verifyCard()}
              disabled={verifyLoading}
              className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50"
            >
              {verifyLoading ? "Checking" : "Verify"}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (desiredCents === null) {
                    setError("Enter a valid desired price.");
                    return;
                  }
                  setError("");
                  setStep(3);
                }}
                className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Review</p>
              {verifiedCard?.imageUrl ? (
                <img
                  src={verifiedCard.imageUrl}
                  alt={autoTitle}
                  className="mt-2 h-32 w-full rounded-2xl border border-slate-200 object-cover"
                />
              ) : null}
              <p className="mt-2 font-display text-xl text-slate-900">{autoTitle}</p>
              <p className="mt-1 text-sm text-slate-600">
                {(verifiedCard?.grader ?? grader)} {verifiedCard?.grade ?? "Grade"} • Cert {cert || "—"}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Desired value: {desiredCents !== null ? formatCurrency(desiredCents, "USD") : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void submitAutoTrade()}
                disabled={submitting}
                className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post trade"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-xs text-slate-600">{verifyLoading ? "Checking certificate..." : verifyNote || "Verify cert to continue."}</p>
        </div>
      </section>

      <section className="ios-panel p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fallback manual form</p>
          <button
            type="button"
            onClick={() => setManualMode((prev) => !prev)}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
          >
            {manualMode ? "Hide" : "Open"}
          </button>
        </div>

        {manualMode ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={manualDraft.title}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Title"
                className="ios-input"
              />
              <input
                value={manualDraft.lookingFor}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, lookingFor: event.target.value }))}
                placeholder="Looking for"
                className="ios-input"
              />
              <input
                value={desiredPrice}
                onChange={(event) => setDesiredPrice(event.target.value)}
                inputMode="decimal"
                placeholder="Desired value (USD)"
                className="ios-input"
              />
              <input
                value={manualDraft.category}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Category"
                className="ios-input"
              />
              <input
                value={manualDraft.cardSet}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, cardSet: event.target.value }))}
                placeholder="Set"
                className="ios-input"
              />
              <input
                value={manualDraft.cardNumber}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, cardNumber: event.target.value }))}
                placeholder="Card number"
                className="ios-input"
              />
              <input
                value={manualDraft.condition}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, condition: event.target.value }))}
                placeholder="Condition"
                className="ios-input"
              />
              <input
                value={manualDraft.gradeCompany}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, gradeCompany: event.target.value }))}
                placeholder="Grade company"
                className="ios-input"
              />
              <input
                value={manualDraft.gradeLabel}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, gradeLabel: event.target.value }))}
                placeholder="Grade"
                className="ios-input"
              />
              <input
                value={manualDraft.tags}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags (comma separated)"
                className="ios-input"
              />
            </div>
            <textarea
              value={manualDraft.description}
              onChange={(event) => setManualDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              placeholder="Description"
              className="ios-input resize-none"
            />
            <button
              type="button"
              onClick={() => void submitManualTrade()}
              disabled={submitting}
              className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post manual trade"}
            </button>
          </div>
        ) : null}
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
      </section>
    </div>
  );
}
