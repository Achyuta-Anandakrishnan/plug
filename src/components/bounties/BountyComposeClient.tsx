"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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
import {
  bountyAmountLabel,
  bountyBudgetLabel,
  type BountySearchSuggestion,
} from "@/lib/bounties";

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

function suggestionSourceLabel(source: BountySearchSuggestion["source"]) {
  if (source === "listing") return "Listing";
  if (source === "trade") return "Trade";
  if (source === "cert") return "Cert";
  return "Bounty";
}

export function BountyComposeClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories } = useCategories();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [grader, setGrader] = useState<CertGrader>("PSA");
  const [certNumber, setCertNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedCard, setVerifiedCard] = useState<VerifyCardPayload | null>(null);
  const [verifyNote, setVerifyNote] = useState("");

  const [itemName, setItemName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [player, setPlayer] = useState("");
  const [setName, setSetName] = useState("");
  const [year, setYear] = useState("");
  const [gradeCompany, setGradeCompany] = useState("");
  const [gradeTarget, setGradeTarget] = useState("");
  const [condition, setCondition] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<BountySearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const cert = certNumber.replace(/\s+/g, "").trim();
  const desiredMin = useMemo(() => toCents(priceMin), [priceMin]);
  const desiredMax = useMemo(() => toCents(priceMax), [priceMax]);
  const desiredBounty = useMemo(() => toCents(bountyAmount), [bountyAmount]);
  const imageChoices = useMemo(() => getCardImageUrls(verifiedCard), [verifiedCard]);
  const resolvedTitle = title.trim() || itemName.trim();

  useEffect(() => {
    const q = itemName.trim();
    if (step !== 1 || q.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(`/api/bounties/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const payload = (await response.json()) as BountySearchSuggestion[] & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to search cards.");
        }
        if (!cancelled) {
          setSuggestions(payload);
          setSuggestionsOpen(true);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [itemName, step]);

  const applySuggestion = (suggestion: BountySearchSuggestion) => {
    setItemName(suggestion.itemName || suggestion.title);
    setTitle((current) => current || suggestion.title);
    setCategory((current) => current || suggestion.category || "");
    setPlayer((current) => current || suggestion.player || "");
    setSetName((current) => current || suggestion.setName || "");
    setYear((current) => current || suggestion.year || "");
    setGradeCompany((current) => current || suggestion.gradeCompany || "");
    setGradeTarget((current) => current || suggestion.gradeTarget || "");
    setCertNumber((current) => current || suggestion.certNumber || "");
    setImageUrl((current) => current || suggestion.imageUrl || "");
    setSuggestionsOpen(false);
  };

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
        setPlayer((current) => current || payload.player || payload.subject || "");
        setSetName((current) => current || payload.set || payload.brand || "");
        setYear((current) => current || payload.year || "");
        setGradeCompany((current) => current || payload.grader || "");
        setGradeTarget((current) => current || payload.label || payload.grade || "");
        setCondition((current) => current || [payload.grader, payload.label ?? payload.grade].filter(Boolean).join(" ").trim());
        setImageUrl((current) => current || getCardImageUrls(payload)[0] || "");
      }
    } catch (verifyError) {
      setError(normalizeClientError(verifyError, "Unable to verify cert."));
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitBounty = async () => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }
    if (!itemName.trim() && !title.trim()) {
      setError("Card or item name is required.");
      setStep(1);
      return;
    }
    if (!imageUrl.trim()) {
      setError("Add an image of the card you are looking for.");
      setStep(1);
      return;
    }
    if (desiredMin === null && desiredMax === null) {
      setError("Add a budget or budget range.");
      setStep(3);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetchClientApi("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resolvedTitle,
          itemName: itemName.trim() || resolvedTitle,
          category: category || null,
          player: player || null,
          setName: setName || null,
          year: year || null,
          gradeCompany: gradeCompany || null,
          gradeTarget: gradeTarget || null,
          condition: condition || null,
          certNumber: cert || null,
          priceMin: desiredMin,
          priceMax: desiredMax,
          bountyAmount: desiredBounty,
          notes: notes.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Unable to post bounty.");
      }
      router.push(`/bounties/${payload.id}`);
      router.refresh();
    } catch (submitError) {
      setError(normalizeClientError(submitError, "Unable to post bounty."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="bounty-compose-page app-page--bounty-compose">
      <section className="app-section">
        <PageHeader
          eyebrow="Bounty"
          title="Post bounty"
          subtitle="Search the card, set your budget, add a bounty, and publish a real buyer request."
          actions={<SecondaryButton href="/bounties">Back to board</SecondaryButton>}
        />

        <ol className="app-stepper" aria-label="Bounty steps">
          {["Search", "Requirements", "Budget", "Notes", "Review"].map((label, index) => (
            <li key={label} className={`app-step ${step >= index + 1 ? "is-active" : ""}`}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>

        <FormContainer>
          <section className="product-card bounty-compose-card">
            {error ? <p className="app-form-note is-error">{error}</p> : null}

            {step === 1 ? (
              <div className="app-form">
                <div className="bounty-search-shell">
                  <label className="app-form-field">
                    <span>Search card or item</span>
                    <input
                      value={itemName}
                      onChange={(event) => {
                        setItemName(event.target.value);
                        setSuggestionsOpen(true);
                      }}
                      className="app-form-input"
                      placeholder="Shohei red refractor auto, 1952 Mickey Mantle, 76565642"
                    />
                  </label>
                  {suggestionsOpen && (suggestionsLoading || suggestions.length > 0) ? (
                    <div className="bounty-search-results" role="listbox" aria-label="Card suggestions">
                      {suggestionsLoading ? <p className="app-form-note">Searching existing inventory and verified cards...</p> : null}
                      {!suggestionsLoading ? suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="bounty-search-result"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          <div>
                            <strong>{suggestion.title}</strong>
                            <span>{suggestion.subtitle}</span>
                          </div>
                          <em>{suggestionSourceLabel(suggestion.source)}</em>
                        </button>
                      )) : null}
                    </div>
                  ) : null}
                </div>

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
                    <div className="bounty-cert-row">
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

                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Headline</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="app-form-input"
                      placeholder="Clean short title for the bounty"
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
                  <span>Image URL <span className="app-form-required">*</span></span>
                  <input
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    className="app-form-input"
                    placeholder="https://..."
                  />
                </label>

                {imageChoices.length > 0 ? (
                  <div className="bounty-compose-image-choices">
                    {imageChoices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`bounty-compose-image-choice ${imageUrl === choice ? "is-active" : ""}`}
                        onClick={() => setImageUrl(choice)}
                      >
                        <Image src={choice} alt="" fill className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="bounty-compose-actions">
                  <div className="app-toolbar-spacer" aria-hidden="true" />
                  <PrimaryButton onClick={() => setStep(2)}>Next</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="app-form">
                <div className="app-form-grid app-form-grid--2">
                  <label className="app-form-field">
                    <span>Player / subject</span>
                    <input value={player} onChange={(event) => setPlayer(event.target.value)} className="app-form-input" placeholder="Shohei Ohtani" />
                  </label>
                  <label className="app-form-field">
                    <span>Set / product</span>
                    <input value={setName} onChange={(event) => setSetName(event.target.value)} className="app-form-input" placeholder="2023 Topps Chrome" />
                  </label>
                </div>

                <div className="app-form-grid app-form-grid--3">
                  <label className="app-form-field">
                    <span>Year</span>
                    <input value={year} onChange={(event) => setYear(event.target.value)} className="app-form-input" placeholder="1952" />
                  </label>
                  <label className="app-form-field">
                    <span>Grade company</span>
                    <input value={gradeCompany} onChange={(event) => setGradeCompany(event.target.value)} className="app-form-input" placeholder="PSA" />
                  </label>
                  <label className="app-form-field">
                    <span>Grade target</span>
                    <input value={gradeTarget} onChange={(event) => setGradeTarget(event.target.value)} className="app-form-input" placeholder="6 / GEM MT 10" />
                  </label>
                </div>

                <label className="app-form-field">
                  <span>Condition or eye appeal notes</span>
                  <input
                    value={condition}
                    onChange={(event) => setCondition(event.target.value)}
                    className="app-form-input"
                    placeholder="Strong centering, no stains, clean surface"
                  />
                </label>

                <div className="bounty-compose-actions">
                  <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => setStep(3)}>Next</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="app-form">
                <div className="app-form-grid app-form-grid--3">
                  <label className="app-form-field">
                    <span>Budget min</span>
                    <input value={priceMin} onChange={(event) => setPriceMin(event.target.value)} className="app-form-input" inputMode="decimal" placeholder="40000" />
                  </label>
                  <label className="app-form-field">
                    <span>Budget max</span>
                    <input value={priceMax} onChange={(event) => setPriceMax(event.target.value)} className="app-form-input" inputMode="decimal" placeholder="50000" />
                  </label>
                  <label className="app-form-field">
                    <span>Bounty amount</span>
                    <input value={bountyAmount} onChange={(event) => setBountyAmount(event.target.value)} className="app-form-input" inputMode="decimal" placeholder="2500" />
                  </label>
                </div>
                <p className="app-form-note">Budget is what you will pay for the card. Bounty is the extra incentive for the seller or finder.</p>

                <div className="bounty-compose-actions">
                  <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => setStep(4)}>Next</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="app-form">
                <label className="app-form-field">
                  <span>Notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 240))}
                    className="app-form-textarea"
                    placeholder="Tell sellers what matters: eye appeal, auto grade, centering, serial range, or why you want this copy."
                    rows={5}
                  />
                </label>
                <p className="app-form-note">{240 - notes.length} characters left.</p>

                <div className="bounty-compose-actions">
                  <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => setStep(5)}>Review</PrimaryButton>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="app-form bounty-review-card">
                <div className="bounty-review-grid">
                  <div className="bounty-review-media">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={resolvedTitle || itemName || "Bounty preview"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span>Bounty preview</span>
                    )}
                  </div>
                  <div className="bounty-review-copy">
                    <span className="listing-card-badge trade-status-chip is-open">Bounty</span>
                    <h2>{resolvedTitle || itemName || "Untitled bounty"}</h2>
                    <p>{[gradeCompany, gradeTarget, condition].filter(Boolean).join(" • ") || "No specific grade target added yet."}</p>
                    <strong>{bountyBudgetLabel(desiredMin, desiredMax)}</strong>
                    <strong className="bounty-review-bonus">{bountyAmountLabel(desiredBounty)}</strong>
                    {cert ? <p>Cert {cert}</p> : null}
                    {notes.trim() ? <p>{notes.trim()}</p> : null}
                  </div>
                </div>

                <div className="bounty-compose-actions">
                  <SecondaryButton onClick={() => setStep(4)}>Back</SecondaryButton>
                  <PrimaryButton onClick={() => void submitBounty()} disabled={submitting}>
                    {submitting ? "Posting..." : "Post bounty"}
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
