"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "@/components/product/ProductUI";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import {
  formatTradeDateTime,
  isValidImageUrl,
  toTagArray,
  tradeValueLabel,
  type TradeDuelItem,
  type TradeDuelMode,
  type TradeOfferItem,
  type TradePostDetail,
} from "@/lib/trade-client";

type OfferDraftCard = {
  title: string;
  cardSet: string;
  cardNumber: string;
  condition: string;
  gradeCompany: string;
  gradeLabel: string;
  estimatedValue: string;
  notes: string;
};

type CounterDraft = {
  open: boolean;
  message: string;
  cashAdjustment: string;
  resolution: "STANDARD" | "DUEL";
  duelMode: TradeDuelMode;
  duelTerms: string;
  duelScheduledFor: string;
  duelDurationMinutes: string;
};

const DUEL_OPTIONS: Array<{ value: TradeDuelMode; label: string }> = [
  { value: "checkers", label: "Checkers" },
  { value: "chess", label: "Chess" },
  { value: "coin", label: "Flip coin" },
  { value: "poker", label: "Hand of poker" },
];

const emptyOfferCard: OfferDraftCard = {
  title: "",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradeCompany: "",
  gradeLabel: "",
  estimatedValue: "",
  notes: "",
};

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const body = await response.text();
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function postStatusClass(status: TradePostDetail["status"]) {
  if (status === "OPEN") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "MATCHED") return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "PAUSED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

function offerStatusClass(status: TradeOfferItem["status"]) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DECLINED" || status === "WITHDRAWN") return "border-slate-200 bg-white text-slate-500";
  if (status === "COUNTERED") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function settlementStatusClass(status: NonNullable<TradeOfferItem["settlement"]>["status"]) {
  if (status === "SUCCEEDED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED" || status === "CANCELED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "PROCESSING") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDatetimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function duelStatusClass(status: NonNullable<TradeDuelItem["status"]>) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "COMPLETED") return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "READY") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "SCHEDULED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

export default function TradeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const postId = useMemo(() => (Array.isArray(params.id) ? params.id[0] : params.id), [params.id]);

  const [post, setPost] = useState<TradePostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [startingCheckoutOfferId, setStartingCheckoutOfferId] = useState<string | null>(null);
  const [offerMessage, setOfferMessage] = useState("");
  const [cashAdjustment, setCashAdjustment] = useState("");
  const [offerCards, setOfferCards] = useState<OfferDraftCard[]>([{ ...emptyOfferCard }]);
  const [counterDrafts, setCounterDrafts] = useState<Record<string, CounterDraft>>({});

  const refresh = async (options?: { silent?: boolean }) => {
    if (!postId) return;
    const encodedPostId = encodeURIComponent(postId);
    if (!options?.silent) {
      setLoading(true);
    }
    setError("");
    setNotFound(false);
    try {
      const response = await fetchClientApi(`/api/trades/${encodedPostId}`, { cache: "no-store" });
      const payload = await readJsonSafely<TradePostDetail & { error?: string }>(response);
      if (!response.ok) {
        if (response.status === 404) {
          setPost(null);
          setNotFound(true);
          if (!options?.silent) {
            setLoading(false);
          }
          return;
        }
        throw new Error(payload?.error || `Unable to load trade (${response.status}).`);
      }
      if (!payload) {
        throw new Error("Trade detail returned an empty response.");
      }
      setPost(payload);
      setNotFound(false);
      if (!options?.silent) {
        setLoading(false);
      }
    } catch (err) {
      setError(normalizeClientError(err, "Unable to load trade."));
      if (!options?.silent) {
        setLoading(false);
      }
      if (!options?.silent) {
        setNotFound(false);
      }
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    if (!postId) return undefined;
    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, 8000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const updatePostStatus = async (status: TradePostDetail["status"]) => {
    if (!postId) return;
    const encodedPostId = encodeURIComponent(postId);
    setUpdatingStatus(true);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/${encodedPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error || "Unable to update status.");
      await refresh();
    } catch (err) {
      setError(normalizeClientError(err, "Unable to update status."));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateOfferStatus = async (
    offerId: string,
    payload: {
      status?: TradeOfferItem["status"];
      message?: string;
      cashAdjustment?: number;
      counterMode?: "STANDARD" | "DUEL";
      duelMode?: TradeDuelMode;
      duelTerms?: string;
      duelScheduledFor?: string | null;
      duelDurationMinutes?: number | string | null;
      gameAction?: "AGREE_TERMS" | "START_GAME";
    },
  ) => {
    setActingOfferId(offerId);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(responsePayload?.error || "Unable to update offer.");
      }
      await refresh();
      return true;
    } catch (err) {
      setError(normalizeClientError(err, "Unable to update offer."));
      return false;
    } finally {
      setActingOfferId(null);
    }
  };

  const agreeToDuelTerms = async (offerId: string) => {
    await updateOfferStatus(offerId, { gameAction: "AGREE_TERMS" });
  };

  const startCheckout = async (offerId: string) => {
    setStartingCheckoutOfferId(offerId);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/offers/${offerId}/checkout`, {
        method: "POST",
      });
      const payload = await readJsonSafely<{ checkoutUrl?: string | null; error?: string; paid?: boolean }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start settlement checkout.");
      }
      if (payload?.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      if (payload?.checkoutUrl) {
        throw new Error("Checkout link is invalid.");
      }
      await refresh();
    } catch (err) {
      setError(normalizeClientError(err, "Unable to start settlement checkout."));
    } finally {
      setStartingCheckoutOfferId(null);
    }
  };

  const submitOffer = async () => {
    if (!postId) return;
    const encodedPostId = encodeURIComponent(postId);
    const cards = offerCards
      .map((entry) => ({
        title: entry.title.trim(),
        cardSet: entry.cardSet.trim(),
        cardNumber: entry.cardNumber.trim(),
        condition: entry.condition.trim(),
        gradeCompany: entry.gradeCompany.trim(),
        gradeLabel: entry.gradeLabel.trim(),
        estimatedValue: entry.estimatedValue.trim() ? Number(entry.estimatedValue) : null,
        notes: entry.notes.trim(),
      }))
      .filter((entry) => entry.title.length > 0);

    if (!offerMessage.trim() && cards.length === 0) {
      setError("Add a message or at least one card to offer.");
      return;
    }

    setSubmittingOffer(true);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/${encodedPostId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: offerMessage.trim(),
          cashAdjustment: cashAdjustment.trim() ? Number(cashAdjustment) : 0,
          cards,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error || "Unable to submit offer.");
      setOfferMessage("");
      setCashAdjustment("");
      setOfferCards([{ ...emptyOfferCard }]);
      await refresh();
    } catch (err) {
      setError(normalizeClientError(err, "Unable to submit offer."));
    } finally {
      setSubmittingOffer(false);
    }
  };

  const replaceOfferCard = (index: number, key: keyof OfferDraftCard, value: string) => {
    setOfferCards((prev) => prev.map((entry, idx) => (
      idx === index ? { ...entry, [key]: value } : entry
    )));
  };

  const addOfferCard = () => {
    setOfferCards((prev) => [...prev, { ...emptyOfferCard }].slice(0, 6));
  };

  const removeOfferCard = (index: number) => {
    setOfferCards((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openCounterDraft = (offer: TradeOfferItem) => {
    setCounterDrafts((prev) => ({
      ...prev,
      [offer.id]: {
        open: true,
        message: offer.message ?? "",
        cashAdjustment: String(offer.cashAdjustment ?? 0),
        resolution: offer.duel || offer.gameType ? "DUEL" : "STANDARD",
        duelMode: offer.duel?.mode ?? offer.gameType ?? "checkers",
        duelTerms: offer.duel?.terms ?? offer.gameTerms ?? "If I win the duel, my counter terms become the accepted trade.",
        duelScheduledFor: formatDatetimeInput(offer.duel?.scheduledFor),
        duelDurationMinutes: offer.duel?.durationSeconds ? String(Math.round(offer.duel.durationSeconds / 60)) : "15",
      },
    }));
  };

  const setCounterField = (
    offerId: string,
    field: "message" | "cashAdjustment" | "resolution" | "duelMode" | "duelTerms" | "duelScheduledFor" | "duelDurationMinutes",
    value: string,
  ) => {
    setCounterDrafts((prev) => ({
      ...prev,
      [offerId]: (() => {
        const base: CounterDraft = {
          open: true,
          message: prev[offerId]?.message ?? "",
          cashAdjustment: prev[offerId]?.cashAdjustment ?? "0",
          resolution: prev[offerId]?.resolution ?? "STANDARD",
          duelMode: prev[offerId]?.duelMode ?? "checkers",
          duelTerms: prev[offerId]?.duelTerms ?? "If I win the duel, my counter terms become the accepted trade.",
          duelScheduledFor: prev[offerId]?.duelScheduledFor ?? "",
          duelDurationMinutes: prev[offerId]?.duelDurationMinutes ?? "15",
        };

        if (field === "message") return { ...base, message: value };
        if (field === "cashAdjustment") return { ...base, cashAdjustment: value };
        if (field === "resolution") {
          return { ...base, resolution: value === "DUEL" ? "DUEL" : "STANDARD" };
        }
        if (field === "duelMode") {
          const nextMode = DUEL_OPTIONS.some((entry) => entry.value === value)
            ? (value as TradeDuelMode)
            : base.duelMode;
          return { ...base, duelMode: nextMode };
        }
        if (field === "duelScheduledFor") return { ...base, duelScheduledFor: value };
        if (field === "duelDurationMinutes") return { ...base, duelDurationMinutes: value };
        return { ...base, duelTerms: value };
      })(),
    }));
  };

  const closeCounterDraft = (offerId: string) => {
    setCounterDrafts((prev) => ({
      ...prev,
      [offerId]: {
        open: false,
        message: prev[offerId]?.message ?? "",
        cashAdjustment: prev[offerId]?.cashAdjustment ?? "0",
        resolution: prev[offerId]?.resolution ?? "STANDARD",
        duelMode: prev[offerId]?.duelMode ?? "checkers",
        duelTerms: prev[offerId]?.duelTerms ?? "If I win the duel, my counter terms become the accepted trade.",
        duelScheduledFor: prev[offerId]?.duelScheduledFor ?? "",
        duelDurationMinutes: prev[offerId]?.duelDurationMinutes ?? "15",
      },
    }));
  };

  const submitCounter = async (offerId: string) => {
    const draft = counterDrafts[offerId];
    const cash = Number(draft?.cashAdjustment ?? "0");
    if (!Number.isFinite(cash)) {
      setError("Counter cash adjustment must be a number in cents.");
      return;
    }
    if (draft?.resolution === "DUEL") {
      if (!draft.duelTerms.trim() || draft.duelTerms.trim().length < 12) {
        setError("Duel terms must be at least 12 characters.");
        return;
      }
    }

    await updateOfferStatus(offerId, {
      status: "COUNTERED",
      message: draft?.message?.trim() || "",
      cashAdjustment: Math.trunc(cash),
      counterMode: draft?.resolution ?? "STANDARD",
      duelMode: draft?.duelMode,
      duelTerms: draft?.duelTerms?.trim(),
      duelScheduledFor: draft?.duelScheduledFor?.trim() || null,
      duelDurationMinutes: draft?.duelDurationMinutes?.trim() || null,
    });

    closeCounterDraft(offerId);
  };

  if (loading) {
    return <CheckersLoader title="Loading trade..." compact className="ios-empty" />;
  }

  if (error && !post) {
    return (
      <PageContainer className="trade-detail-page app-page--trade-detail">
        <section className="app-section">
          <div className="ios-empty">
            <div className="product-card trade-detail-empty-state">
              <h2>Trade unavailable</h2>
              <p>{error}</p>
              <div className="trade-detail-head-actions">
                <SecondaryButton href="/trades">Back to trades</SecondaryButton>
                <PrimaryButton onClick={() => void refresh()}>Try again</PrimaryButton>
              </div>
            </div>
          </div>
        </section>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer className="trade-detail-page app-page--trade-detail">
        <section className="app-section">
          <div className="ios-empty">
            <div className="product-card trade-detail-empty-state">
              <h2>Trade not found</h2>
              <p>This trade may have been removed, archived, or never existed.</p>
              <div className="trade-detail-head-actions">
                <SecondaryButton href="/trades">Back to trades</SecondaryButton>
              </div>
            </div>
          </div>
        </section>
      </PageContainer>
    );
  }

  if (!post) {
    return <CheckersLoader title="Loading trade..." compact className="ios-empty" />;
  }

  const tags = toTagArray(post.tags);
  const currentUserId = session?.user?.id ?? "";
  const ownerLabel = post.owner.displayName ?? post.owner.username ?? "Member";

  return (
    <PageContainer className="trade-detail-page app-page--trade-detail">
      <section className="app-section">
        <PageHeader
          eyebrow="Trade listing"
          title={post.title}
          subtitle={`by ${ownerLabel} · ${tradeValueLabel(post.valueMin, post.valueMax)} · ${post._count.offers} offers`}
          className="trade-detail-header"
          actions={(
            <div className="trade-detail-head-actions">
              <SecondaryButton href="/trades">Back</SecondaryButton>
              {post.viewer.isOwner ? (
                <PrimaryButton onClick={() => router.push("/trades/new")}>New post</PrimaryButton>
              ) : null}
            </div>
          )}
        />

        <div className="trade-detail-meta-row">
          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${postStatusClass(post.status)}`}>
            {post.status}
          </span>
          <span>{formatTradeDateTime(post.createdAt)}</span>
          {post.shippingMode ? <span>{post.shippingMode}</span> : null}
          {post.location ? <span>{post.location}</span> : null}
        </div>

        {tags.length > 0 ? (
          <div className="trade-detail-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <section className="trade-detail-layout">
          <section className="product-card trade-detail-gallery">
            <SectionHeader
              title="Card gallery"
              subtitle={post.images.length > 0 ? `${post.images.length} image${post.images.length === 1 ? "" : "s"}` : "No uploaded photos"}
            />
            {post.images.length > 0 ? (
              <div className="trade-detail-gallery-grid">
                {post.images.map((image) => {
                  const canRender = isValidImageUrl(image.url);
                  return (
                    <div key={image.id} className="trade-detail-gallery-item">
                      {canRender ? (
                        <img
                          src={image.url}
                          alt={post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="trade-detail-gallery-fallback">Image unavailable</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="trade-detail-gallery-item">
                <Image
                  src={resolveDisplayMediaUrl(null)}
                  alt="Card placeholder"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            )}
          </section>

          <aside className="trade-detail-sidebar">
            <section className="product-card trade-detail-summary">
              <SectionHeader title="Trade details" subtitle="What the collector wants back." />
              <p className="trade-detail-looking">{post.lookingFor}</p>
              {post.description ? <p className="trade-detail-description">{post.description}</p> : null}
              <div className="trade-detail-summary-grid">
                <div>
                  <span>Range</span>
                  <strong>{tradeValueLabel(post.valueMin, post.valueMax)}</strong>
                </div>
                <div>
                  <span>Offers</span>
                  <strong>{post._count.offers}</strong>
                </div>
              </div>
            </section>

            {post.viewer.isOwner ? (
              <section className="product-card trade-detail-status-panel">
                <SectionHeader title="Post status" subtitle="Keep the trade board current." />
                <div className="trade-detail-status-actions">
                  {(["OPEN", "PAUSED", "CLOSED"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void updatePostStatus(status)}
                      disabled={updatingStatus || post.status === status}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                        post.status === status
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white/90 text-slate-700"
                      } disabled:opacity-50`}
                    >
                      {status.toLowerCase()}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {post.viewer.canOffer ? (
              <section className="product-card trade-detail-offer-panel">
                <SectionHeader title="Send offer" subtitle="Pitch the deal and add matching cards." />
                <textarea
                  value={offerMessage}
                  onChange={(event) => setOfferMessage(event.target.value)}
                  className="trade-detail-textarea"
                  placeholder="Trade pitch"
                />
                <input
                  value={cashAdjustment}
                  onChange={(event) => setCashAdjustment(event.target.value)}
                  className="ios-input"
                  inputMode="numeric"
                  placeholder="Cash adjustment in cents (+/-)"
                />
                <div className="trade-detail-offer-cards">
                  {offerCards.map((card, index) => (
                    <div key={`${card.title}-${index}`} className="trade-detail-offer-card">
                      <input
                        value={card.title}
                        onChange={(event) => replaceOfferCard(index, "title", event.target.value)}
                        className="ios-input"
                        placeholder="Offered card title"
                      />
                      <div className="trade-detail-offer-grid">
                        <input
                          value={card.cardSet}
                          onChange={(event) => replaceOfferCard(index, "cardSet", event.target.value)}
                          className="ios-input"
                          placeholder="Set"
                        />
                        <input
                          value={card.cardNumber}
                          onChange={(event) => replaceOfferCard(index, "cardNumber", event.target.value)}
                          className="ios-input"
                          placeholder="Number"
                        />
                        <input
                          value={card.condition}
                          onChange={(event) => replaceOfferCard(index, "condition", event.target.value)}
                          className="ios-input"
                          placeholder="Condition"
                        />
                        <input
                          value={card.estimatedValue}
                          onChange={(event) => replaceOfferCard(index, "estimatedValue", event.target.value)}
                          className="ios-input"
                          placeholder="Estimated value (cents)"
                        />
                        <input
                          value={card.gradeCompany}
                          onChange={(event) => replaceOfferCard(index, "gradeCompany", event.target.value)}
                          className="ios-input"
                          placeholder="Grade co"
                        />
                        <input
                          value={card.gradeLabel}
                          onChange={(event) => replaceOfferCard(index, "gradeLabel", event.target.value)}
                          className="ios-input"
                          placeholder="Grade"
                        />
                      </div>
                      <input
                        value={card.notes}
                        onChange={(event) => replaceOfferCard(index, "notes", event.target.value)}
                        className="ios-input"
                        placeholder="Notes"
                      />
                      {offerCards.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeOfferCard(index)}
                          className="trade-detail-remove"
                        >
                          Remove card
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="trade-detail-offer-actions">
                  <SecondaryButton onClick={addOfferCard}>Add card</SecondaryButton>
                  <PrimaryButton onClick={() => void submitOffer()} disabled={submittingOffer}>
                    {submittingOffer ? "Sending..." : "Submit offer"}
                  </PrimaryButton>
                </div>
              </section>
            ) : !session?.user?.id ? (
              <section className="product-card trade-detail-offer-panel">
                <SectionHeader title="Send offer" subtitle="Sign in to start negotiating." />
                <p className="trade-detail-description">You need an account to send cards, counter, and complete settlement.</p>
                <PrimaryButton onClick={() => signIn()}>Sign in</PrimaryButton>
              </section>
            ) : null}
          </aside>
        </section>

        <section className="product-card trade-detail-offers">
          <SectionHeader title="Offers" action={<span className="market-count">{post.offers.length}</span>} />

        {post.offers.length === 0 ? (
          <div className="ios-empty mt-3">No offers yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {post.offers.map((offer) => {
              const viewerIsProposer = offer.proposerId === currentUserId;
              const activeOffer = ["PENDING", "COUNTERED"].includes(offer.status);
              const canDecline = activeOffer && post.viewer.isOwner;
              const duel = offer.duel;
              const canCounter = activeOffer
                && (post.viewer.isOwner || viewerIsProposer)
                && (offer.status === "PENDING" ? post.viewer.isOwner : (duel?.challengerId ?? offer.gameProposedById) !== currentUserId);
              const canWithdraw = viewerIsProposer && activeOffer;
              const counterDraft = counterDrafts[offer.id];
              const settlement = offer.settlement;
              const isSettlementPayer = settlement?.payerId === currentUserId;
              const canPaySettlement = offer.status === "ACCEPTED" && settlement && settlement.status !== "SUCCEEDED" && isSettlementPayer;
              const hasDuelCounter = offer.status === "COUNTERED" && Boolean(duel || (offer.gameType && offer.gameTerms));
              const duelStatus = duel?.status === "SCHEDULED" && duel.scheduledFor && new Date(duel.scheduledFor).getTime() <= Date.now()
                ? "READY"
                : duel?.status ?? "PENDING";
              const canAccept = activeOffer
                && !hasDuelCounter
                && (post.viewer.isOwner || (viewerIsProposer && offer.status === "COUNTERED"));
              const ownerAgreed = Boolean(duel
                ? (duel.challengerId === post.ownerId ? duel.challengerAgreedAt : duel.defenderAgreedAt)
                : offer.gameOwnerAgreedAt);
              const proposerAgreed = Boolean(duel
                ? (duel.challengerId === offer.proposerId ? duel.challengerAgreedAt : duel.defenderAgreedAt)
                : offer.gameProposerAgreedAt);
              const bothAgreed = ownerAgreed && proposerAgreed;
              const viewerCanAgreeTerms = hasDuelCounter && (
                (post.viewer.isOwner && !ownerAgreed)
                || (viewerIsProposer && !proposerAgreed)
              );
              const duelActionLabel = duelStatus === "COMPLETED"
                ? "View result"
                : duelStatus === "ACTIVE"
                  ? "Rejoin duel"
                  : duelStatus === "SCHEDULED"
                    ? "View schedule"
                    : bothAgreed
                      ? "Open duel"
                      : "Open duel setup";

              return (
                <div
                  key={offer.id}
                  className="trade-detail-offer-row"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {offer.proposer.displayName ?? offer.proposer.username ?? "Member"}
                      </p>
                      <p className="text-xs text-slate-500">{formatTradeDateTime(offer.createdAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${offerStatusClass(offer.status)}`}>
                      {offer.status}
                    </span>
                  </div>

                  {offer.message ? <p className="mt-2 text-sm text-slate-700">{offer.message}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Cash adjustment: {offer.cashAdjustment >= 0 ? "+" : ""}{offer.cashAdjustment} cents
                    {offer.cashAdjustment !== 0 ? ` (${formatCurrency(Math.abs(offer.cashAdjustment), "USD")})` : ""}
                  </p>

                  {hasDuelCounter ? (
                    <div className="trade-offer-duel-panel">
                      <div className="trade-offer-duel-head">
                        <div>
                          <p className="trade-offer-duel-eyebrow">Duel terms</p>
                          <p className="trade-offer-duel-title">
                            {DUEL_OPTIONS.find((entry) => entry.value === (duel?.mode ?? offer.gameType))?.label ?? duel?.mode ?? offer.gameType}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${duelStatusClass(duelStatus)}`}>
                          {duelStatus}
                        </span>
                      </div>
                      <p className="trade-offer-duel-copy">{duel?.terms ?? offer.gameTerms}</p>
                      {duel?.scheduledFor ? (
                        <p className="trade-offer-duel-meta">Scheduled for {formatTradeDateTime(duel.scheduledFor)}</p>
                      ) : null}
                      {duel?.durationSeconds ? (
                        <p className="trade-offer-duel-meta">Clock: {Math.round(duel.durationSeconds / 60)} minutes</p>
                      ) : null}
                      <div className="trade-offer-duel-statuses">
                        <span className={`rounded-full border px-2 py-1 ${ownerAgreed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                          Owner {ownerAgreed ? "ready" : "pending"}
                        </span>
                        <span className={`rounded-full border px-2 py-1 ${proposerAgreed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                          Proposer {proposerAgreed ? "ready" : "pending"}
                        </span>
                      </div>
                      <div className="trade-offer-duel-actions">
                        {viewerCanAgreeTerms ? (
                          <button
                            type="button"
                            onClick={() => void agreeToDuelTerms(offer.id)}
                            disabled={actingOfferId === offer.id}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-60"
                          >
                            Approve duel
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => router.push(`/trades/${encodeURIComponent(post.id)}/duel?offer=${encodeURIComponent(offer.id)}`)}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                        >
                          {duelActionLabel}
                        </button>
                        {!bothAgreed ? (
                          <span className="trade-offer-duel-hint">Dalow unlocks the duel after both approvals.</span>
                        ) : null}
                      </div>
                      {duel?.completedAt && duel?.winnerId ? (
                        <p className="trade-offer-duel-result">
                          Duel settled. Winner: {duel.winnerId === offer.proposerId ? "Proposer" : "Owner"}.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {offer.cards.length > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {offer.cards.map((card) => (
                        <div key={card.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
                          <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[card.cardSet, card.cardNumber, card.condition].filter(Boolean).join(" • ") || "No extra card details"}
                          </p>
                          {(card.gradeCompany || card.gradeLabel) ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {[card.gradeCompany, card.gradeLabel].filter(Boolean).join(" ")}
                            </p>
                          ) : null}
                          {card.estimatedValue ? (
                            <p className="mt-1 text-xs text-slate-500">Est: {formatCurrency(card.estimatedValue, "USD")}</p>
                          ) : null}
                          {card.notes ? <p className="mt-1 text-xs text-slate-500">{card.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {settlement ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cash settlement</p>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${settlementStatusClass(settlement.status)}`}>
                          {settlement.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {formatCurrency(settlement.amount, (settlement.currency || "usd").toUpperCase())}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {settlement.payer.displayName ?? settlement.payer.username ?? "Payer"} pays {settlement.payee.displayName ?? settlement.payee.username ?? "Payee"}
                      </p>
                      {settlement.status === "SUCCEEDED" ? (
                        <p className="mt-2 text-xs text-emerald-700">Payment completed.</p>
                      ) : canPaySettlement ? (
                        <button
                          type="button"
                          onClick={() => void startCheckout(offer.id)}
                          disabled={startingCheckoutOfferId === offer.id}
                          className="mt-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                        >
                          {startingCheckoutOfferId === offer.id ? "Opening checkout..." : "Pay with Stripe"}
                        </button>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Waiting on payer to complete Stripe checkout.</p>
                      )}
                    </div>
                  ) : null}

                  {canAccept || canDecline ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canAccept ? (
                        <button
                          type="button"
                          onClick={() => void updateOfferStatus(offer.id, { status: "ACCEPTED" })}
                          disabled={actingOfferId === offer.id}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                        >
                          Accept
                        </button>
                      ) : null}
                      {canCounter ? (
                        <button
                          type="button"
                          onClick={() => openCounterDraft(offer)}
                          disabled={actingOfferId === offer.id}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-60"
                        >
                          Counter
                        </button>
                      ) : null}
                      {canDecline ? (
                        <button
                          type="button"
                          onClick={() => void updateOfferStatus(offer.id, { status: "DECLINED" })}
                          disabled={actingOfferId === offer.id}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-700 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      ) : null}
                    </div>
                  ) : canWithdraw ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, { status: "WITHDRAWN" })}
                        disabled={actingOfferId === offer.id}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-700 disabled:opacity-60"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : null}

                  {counterDraft?.open ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Counter offer</p>
                      <textarea
                        value={counterDraft.message}
                        onChange={(event) => setCounterField(offer.id, "message", event.target.value)}
                        className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                        placeholder="Counter message"
                      />
                      <input
                        value={counterDraft.cashAdjustment}
                        onChange={(event) => setCounterField(offer.id, "cashAdjustment", event.target.value)}
                        className="ios-input mt-2"
                        inputMode="numeric"
                        placeholder="Counter cash adjustment (cents)"
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                          value={counterDraft.resolution}
                          onChange={(event) => setCounterField(offer.id, "resolution", event.target.value)}
                          className="ios-input"
                        >
                          <option value="STANDARD">Standard counter</option>
                          <option value="DUEL">Counter + duel</option>
                        </select>
                        {counterDraft.resolution === "DUEL" ? (
                          <select
                            value={counterDraft.duelMode}
                            onChange={(event) => setCounterField(offer.id, "duelMode", event.target.value)}
                            className="ios-input"
                          >
                            {DUEL_OPTIONS.map((entry) => (
                              <option key={entry.value} value={entry.value}>{entry.label}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      {counterDraft.resolution === "DUEL" ? (
                        <>
                          <textarea
                            value={counterDraft.duelTerms}
                            onChange={(event) => setCounterField(offer.id, "duelTerms", event.target.value)}
                            className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                            placeholder="Duel terms (what happens if the challenger wins)"
                          />
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <input
                              type="datetime-local"
                              value={counterDraft.duelScheduledFor}
                              onChange={(event) => setCounterField(offer.id, "duelScheduledFor", event.target.value)}
                              className="ios-input"
                            />
                            <input
                              value={counterDraft.duelDurationMinutes}
                              onChange={(event) => setCounterField(offer.id, "duelDurationMinutes", event.target.value)}
                              className="ios-input"
                              inputMode="numeric"
                              placeholder="Clock (minutes)"
                            />
                          </div>
                        </>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void submitCounter(offer.id)}
                          disabled={actingOfferId === offer.id}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                        >
                          Send counter
                        </button>
                        <button
                          type="button"
                          onClick={() => closeCounterDraft(offer.id)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        </section>
      </section>
    </PageContainer>
  );
}
