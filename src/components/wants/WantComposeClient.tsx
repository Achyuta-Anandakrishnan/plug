"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { useCategories } from "@/hooks/useCategories";
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
  error?: string;
};

type CertGrader = "PSA" | "CDC" | "BGS" | "BVG";

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
  return Array.from(deduped).slice(0, 6);
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

export function WantComposeClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories } = useCategories();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [grader, setGrader] = useState<CertGrader>("PSA");
  const [certNumber, setCertNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedCard, setVerifiedCard] = useState<VerifyCardPayload | null>(null);
  const [verifyNote, setVerifyNote] = useState("");

  const [itemName, setItemName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [condition, setCondition] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cert = certNumber.replace(/\s+/g, "").trim();
  const desiredMin = useMemo(() => toCents(priceMin), [priceMin]);
  const desiredMax = useMemo(() => toCents(priceMax), [priceMax]);
  const imageChoices = useMemo(() => getCardImageUrls(verifiedCard), [verifiedCard]);
  const resolvedTitle = title.trim() || itemName.trim();

  const verifyCard = async () => {
    if (!cert || cert.length < 4) {
      setError("Enter a valid cert number.");
      return;
    }

    setVerifyLoading(true);
    setVerifyNote("");
    setError("");
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
      setVerifyNote(payload.note || (payload.found ? "Card verified." : "No exact match found."));

      if (payload.found) {
        const nextTitle = buildTitle(cert, payload);
        setTitle((current) => current || nextTitle);
        setItemName((current) => current || nextTitle);
        setCategory((current) => current || payload.category || "");
        setGrade((current) => current || [payload.grader, payload.grade].filter(Boolean).join(" ").trim());
        setCondition((current) => current || [payload.grader, payload.label ?? payload.grade].filter(Boolean).join(" ").trim());
        setImageUrl((current) => current || getCardImageUrls(payload)[0] || "");
        setStep(2);
      }
    } catch (verifyError) {
      setError(normalizeClientError(verifyError, "Unable to verify cert."));
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitWant = async () => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    if (!itemName.trim() && !title.trim()) {
      setError("Item name is required.");
      setStep(1);
      return;
    }
    if (desiredMin === null && desiredMax === null) {
      setError("Add a target price or price range.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetchClientApi("/api/wants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resolvedTitle,
          itemName: itemName.trim() || resolvedTitle,
          category: category || null,
          grade: grade || null,
          condition: condition || null,
          certNumber: cert || null,
          priceMin: desiredMin,
          priceMax: desiredMax,
          notes: notes.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to post want.");
      }
      router.push(`/wants/${payload.id}`);
      router.refresh();
    } catch (submitError) {
      setError(normalizeClientError(submitError, "Unable to post want."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="want-compose-page app-page--want-compose">
      <section className="app-section">
        <PageHeader
          eyebrow="Want Board"
          title="Post Want"
          subtitle="Tell sellers exactly what you're looking to buy."
          actions={<SecondaryButton href="/wants">Back to board</SecondaryButton>}
        />

        <ol className="app-stepper" aria-label="Want board steps">
          <li className={`app-step ${step >= 1 ? "is-active" : ""}`}>
            <span>1</span>
            <strong>Identify</strong>
          </li>
          <li className={`app-step ${step >= 2 ? "is-active" : ""}`}>
            <span>2</span>
            <strong>Budget</strong>
          </li>
          <li className={`app-step ${step >= 3 ? "is-active" : ""}`}>
            <span>3</span>
            <strong>Review</strong>
          </li>
        </ol>

        <FormContainer>
          <section className="product-card want-compose-card">
            {error ? <p className="app-form-note is-error">{error}</p> : null}

            {step === 1 ? (
              <div className="app-form">
                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Cert grader</span>
                    <select value={grader} onChange={(event) => setGrader(event.target.value as CertGrader)} className="app-form-input app-form-select">
                      {certGraders.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="app-form-field">
                    <span>Optional cert #</span>
                    <div className="want-cert-row">
                      <input
                        value={certNumber}
                        onChange={(event) => setCertNumber(event.target.value)}
                        className="app-form-input"
                        placeholder="Enter cert number"
                      />
                      <button type="button" onClick={() => void verifyCard()} className="app-button app-button-secondary" disabled={verifyLoading}>
                        {verifyLoading ? "Checking..." : "Verify"}
                      </button>
                    </div>
                  </label>
                </div>

                {verifyNote ? <p className="app-form-note">{verifyNote}</p> : null}

                <label className="app-form-field">
                  <span>Item name</span>
                  <input
                    value={itemName}
                    onChange={(event) => setItemName(event.target.value)}
                    className="app-form-input"
                    placeholder="1952 Topps #311 Mickey Mantle"
                  />
                </label>

                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Title</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="app-form-input"
                      placeholder="Short headline for the post"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Category</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-form-input app-form-select">
                      <option value="">Select category</option>
                      {categories.map((entry) => (
                        <option key={entry.id} value={entry.name}>{entry.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="app-form-field">
                  <span>Image URL</span>
                  <input
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    className="app-form-input"
                    placeholder="https://..."
                  />
                </label>

                {imageChoices.length > 0 ? (
                  <div className="want-compose-image-choices">
                    {imageChoices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`want-compose-image-choice ${imageUrl === choice ? "is-active" : ""}`}
                        onClick={() => setImageUrl(choice)}
                      >
                        <Image src={choice} alt="" fill className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="want-compose-actions">
                  <div className="app-toolbar-spacer" aria-hidden="true" />
                  <PrimaryButton onClick={() => setStep(2)}>Next</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="app-form">
                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Grade</span>
                    <input
                      value={grade}
                      onChange={(event) => setGrade(event.target.value)}
                      className="app-form-input"
                      placeholder="PSA 6"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Condition</span>
                    <input
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                      className="app-form-input"
                      placeholder="Strong eye appeal"
                    />
                  </label>
                </div>

                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Price min</span>
                    <input
                      value={priceMin}
                      onChange={(event) => setPriceMin(event.target.value)}
                      className="app-form-input"
                      inputMode="decimal"
                      placeholder="42000"
                    />
                  </label>
                  <label className="app-form-field">
                    <span>Price max</span>
                    <input
                      value={priceMax}
                      onChange={(event) => setPriceMax(event.target.value)}
                      className="app-form-input"
                      inputMode="decimal"
                      placeholder="50000"
                    />
                  </label>
                </div>

                <label className="app-form-field">
                  <span>Notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 240))}
                    className="app-form-textarea"
                    placeholder="Need strong eye appeal, centered copy, or specific holo pattern."
                    rows={4}
                  />
                </label>

                <div className="want-compose-actions">
                  <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => setStep(3)}>Review</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="app-form want-review-card">
                <div className="want-review-grid">
                  <div className="want-review-media">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={resolvedTitle || itemName || "Want preview"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span>Want preview</span>
                    )}
                  </div>
                  <div className="want-review-copy">
                    <span className="listing-card-badge trade-status-chip is-open">Want</span>
                    <h2>{resolvedTitle || itemName || "Untitled want"}</h2>
                    <p>{grade || condition || "No condition preference added yet."}</p>
                    <strong>
                      {desiredMin !== null || desiredMax !== null
                        ? `Paying ${[
                            desiredMin !== null ? `$${(desiredMin / 100).toLocaleString()}` : null,
                            desiredMax !== null ? `$${(desiredMax / 100).toLocaleString()}` : null,
                          ].filter(Boolean).join(" - ")}`
                        : "Budget not set"}
                    </strong>
                    {cert ? <p>Cert {cert}</p> : null}
                    {notes.trim() ? <p>{notes.trim()}</p> : null}
                  </div>
                </div>

                <div className="want-compose-actions">
                  <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => void submitWant()} disabled={submitting}>
                    {submitting ? "Posting..." : "Post Want"}
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
          </section>
        </FormContainer>
      </section>
    </PageContainer>
  );
}
