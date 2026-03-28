"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";
import {
  FormContainer,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/product/ProductUI";

type VerifyCardPayload = {
  found?: boolean;
  grader?: string;
  certNumber?: string;
  verificationStatus?: "verified" | "not_found";
  provider?: string;
  player?: string | null;
  set?: string | null;
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
  imageUrls?: string[];
  images?: { front?: string | null; back?: string | null } | string[];
  note?: string;
  source?: "PSA_PUBLIC_API" | "PSA_CERT_PAGE" | "LOOKUP_FALLBACK";
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

type CertGrader = "PSA" | "CDC" | "BGS" | "BVG";

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

function getCardImageUrls(card: VerifyCardPayload | null) {
  if (!card) return [];
  const urlsFromList = Array.isArray(card.imageUrls) ? card.imageUrls : [];
  const urlsFromImages = Array.isArray(card.images)
    ? card.images.filter((entry): entry is string => typeof entry === "string")
    : [card.images?.front ?? null, card.images?.back ?? null];
  return uniqueImageUrls([card.imageUrl ?? null, ...urlsFromList, ...urlsFromImages]);
}

function buildTitle(cert: string, card: VerifyCardPayload | null) {
  if (!card) return `Cert ${cert}`;
  const provided = typeof card.title === "string" ? card.title.trim() : "";
  if (provided) return provided;
  const parts = [
    card.year ?? null,
    card.brand ?? card.set ?? null,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.player ?? card.subject ?? null,
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
    card.brand ? `Brand: ${card.brand}` : null,
    card.set ? `Set: ${card.set}` : null,
    card.player ? `Player: ${card.player}` : null,
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

  const [grader, setGrader] = useState<CertGrader>("PSA");
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
      const requestGrader = grader === "CDC" ? "CGC" : grader;
      const response = await fetchClientApi("/api/verify-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grader: requestGrader, certNumber: cert }),
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
          images: getCardImageUrls(verifiedCard).map((url, index) => ({
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
          images: getCardImageUrls(verifiedCard).map((url, index) => ({
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
      <PageContainer className="trade-compose-page app-page--trade-compose">
        <section className="app-section">
          <FormContainer>
            <PageHeader
              eyebrow="Create listing"
              title="Create listing"
              subtitle="Trade mode. Sign in to verify the item, set value, and publish."
            />
            <ol className="app-stepper trade-compose-stepper" aria-label="Trade post steps">
              {["Verify", "Value", "Review"].map((label, index) => (
                <li
                  key={label}
                  className={`app-step ${index === 0 ? "is-active" : ""}`}
                >
                  <span>{index + 1}</span>
                  <strong>{label}</strong>
                </li>
              ))}
            </ol>
            <nav className="listing-flow-strip" aria-label="Listing modes">
              <Link href="/sell?mode=AUCTION" className="listing-flow-link">Auction</Link>
              <Link href="/sell?mode=BUY_NOW" className="listing-flow-link">Buy now</Link>
              <Link href="/sell?mode=BOTH" className="listing-flow-link">Auction + buy now</Link>
              <Link href="/trades/new" className="listing-flow-link is-active">Trade</Link>
            </nav>
            <div className="trade-compose-signin">
              <p>Sign in to post a trade.</p>
              <PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>
            </div>
          </FormContainer>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="trade-compose-page app-page--trade-compose">
      <section className="app-section">
        <FormContainer className="trade-compose-form">
          <PageHeader
            eyebrow="Create listing"
            title="Create listing"
            subtitle="Trade mode. Verify the item, set the target value, and publish."
            actions={<SecondaryButton href="/trades">Back to trades</SecondaryButton>}
          />

          <nav className="listing-flow-strip" aria-label="Listing modes">
            <Link href="/sell?mode=AUCTION" className="listing-flow-link">Auction</Link>
            <Link href="/sell?mode=BUY_NOW" className="listing-flow-link">Buy now</Link>
            <Link href="/sell?mode=BOTH" className="listing-flow-link">Auction + buy now</Link>
            <Link href="/trades/new" className="listing-flow-link is-active">Trade</Link>
          </nav>

          <ol className="app-stepper trade-compose-stepper" aria-label="Trade post steps">
            {[
              { label: "Verify", active: step === 1, complete: step > 1 },
              { label: "Value", active: step === 2, complete: step > 2 },
              { label: "Review", active: step === 3, complete: false },
            ].map((item, index) => (
              <li
                key={item.label}
                className={`app-step ${item.active ? "is-active" : ""} ${item.complete ? "is-complete" : ""}`}
              >
                <span>{index + 1}</span>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ol>

          <section className="product-card trade-compose-panel">
            {step === 1 ? (
              <div className="trade-compose-verify">
                <div className="app-form-grid trade-compose-verify-grid">
                  <label className="app-form-field">
                    <span>Grader</span>
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
                  </label>
                  <label className="app-form-field">
                    <span>Cert number</span>
                    <input
                      value={certNumber}
                      onChange={(event) => setCertNumber(event.target.value)}
                      placeholder="Cert number"
                      className="app-form-input"
                    />
                  </label>
                  <div className="trade-compose-verify-action">
                    <span className="app-eyebrow">Lookup</span>
                    <PrimaryButton onClick={() => void verifyCard()} disabled={verifyLoading}>
                      {verifyLoading ? "Checking..." : "Verify"}
                    </PrimaryButton>
                  </div>
                </div>
                <div className="trade-compose-note">
                  {verifyLoading ? "Checking certificate..." : verifyNote || "Verify the cert to keep the trade clean."}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="trade-compose-value">
                <label className="app-form-field">
                  <span>Desired value (USD)</span>
                  <input
                    value={desiredPrice}
                    onChange={(event) => setDesiredPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="250"
                    className="app-form-input"
                  />
                </label>
                <div className="app-form-actions">
                  <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
                  <PrimaryButton
                    onClick={() => {
                      if (desiredCents === null) {
                        setError("Enter a valid desired price.");
                        return;
                      }
                      setError("");
                      setStep(3);
                    }}
                  >
                    Continue
                  </PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="trade-compose-review">
                <div className="trade-compose-review-card">
                  {getCardImageUrls(verifiedCard)[0] ? (
                    <div className="cert-preview-frame trade-compose-review-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getCardImageUrls(verifiedCard)[0]}
                        alt={autoTitle}
                        className="cert-preview-image"
                      />
                    </div>
                  ) : null}
                  <div className="trade-compose-review-copy">
                    <p className="app-eyebrow">Review</p>
                    <h2>{autoTitle}</h2>
                    <p>
                      {(verifiedCard?.grader ?? grader)} {verifiedCard?.grade ?? "Grade"} • Cert {cert || "—"}
                    </p>
                    <strong>
                      Desired value: {desiredCents !== null ? formatCurrency(desiredCents, "USD") : "—"}
                    </strong>
                  </div>
                </div>
                <div className="app-form-actions">
                  <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => void submitAutoTrade()} disabled={submitting}>
                    {submitting ? "Posting..." : "Post trade"}
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
          </section>

          <section className="product-card trade-compose-manual">
            <div className="trade-compose-manual-head">
              <div>
                <p className="app-eyebrow">Manual fallback</p>
                <p className="trade-compose-note">Use this only when cert lookup cannot verify the card automatically.</p>
              </div>
              <SecondaryButton onClick={() => setManualMode((prev) => !prev)}>
                {manualMode ? "Hide" : "Open"}
              </SecondaryButton>
            </div>

            {manualMode ? (
              <div className="app-form">
                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Title</span>
                    <input
                      value={manualDraft.title}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Title"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Looking for</span>
                    <input
                      value={manualDraft.lookingFor}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, lookingFor: event.target.value }))}
                      placeholder="Looking for"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Desired value</span>
                    <input
                      value={desiredPrice}
                      onChange={(event) => setDesiredPrice(event.target.value)}
                      inputMode="decimal"
                      placeholder="Desired value (USD)"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Category</span>
                    <input
                      value={manualDraft.category}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, category: event.target.value }))}
                      placeholder="Category"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Set</span>
                    <input
                      value={manualDraft.cardSet}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, cardSet: event.target.value }))}
                      placeholder="Set"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Card number</span>
                    <input
                      value={manualDraft.cardNumber}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, cardNumber: event.target.value }))}
                      placeholder="Card number"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Condition</span>
                    <input
                      value={manualDraft.condition}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, condition: event.target.value }))}
                      placeholder="Condition"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Grade company</span>
                    <input
                      value={manualDraft.gradeCompany}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, gradeCompany: event.target.value }))}
                      placeholder="Grade company"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Grade</span>
                    <input
                      value={manualDraft.gradeLabel}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, gradeLabel: event.target.value }))}
                      placeholder="Grade"
                      className="app-form-input"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Tags</span>
                    <input
                      value={manualDraft.tags}
                      onChange={(event) => setManualDraft((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder="Tags (comma separated)"
                      className="app-form-input"
                    />
                  </label>
                </div>

                <label className="app-form-field">
                  <span>Description</span>
                  <textarea
                    value={manualDraft.description}
                    onChange={(event) => setManualDraft((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                    placeholder="Description"
                    className="app-form-textarea"
                  />
                </label>

                <div className="app-form-actions">
                  <PrimaryButton onClick={() => void submitManualTrade()} disabled={submitting}>
                    {submitting ? "Posting..." : "Post manual trade"}
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
          </section>

          {error ? <div className="app-status-note is-error">{error}</div> : null}
          {status ? <div className="app-status-note is-success">{status}</div> : null}
        </FormContainer>
      </section>
    </PageContainer>
  );
}
