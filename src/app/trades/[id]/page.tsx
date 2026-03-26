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
};

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
  if (status === "OPEN") return "is-open";
  if (status === "MATCHED") return "is-matched";
  if (status === "PAUSED") return "is-paused";
  return "";
}

function offerStatusClass(status: TradeOfferItem["status"]) {
  if (status === "ACCEPTED") return "is-open";
  if (status === "DECLINED" || status === "WITHDRAWN") return "";
  if (status === "COUNTERED") return "is-matched";
  return "is-paused";
}

function settlementStatusClass(status: NonNullable<TradeOfferItem["settlement"]>["status"]) {
  if (status === "SUCCEEDED") return "is-open";
  if (status === "FAILED" || status === "CANCELED") return "is-error";
  if (status === "PROCESSING") return "is-matched";
  return "is-paused";
}


function duelStatusClass(status: NonNullable<TradeDuelItem["status"]>) {
  if (status === "ACTIVE") return "is-open";
  if (status === "COMPLETED") return "is-matched";
  if (status === "READY") return "is-ready";
  if (status === "SCHEDULED") return "is-paused";
  return "";
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
      },
    }));
  };

  const setCounterField = (offerId: string, field: "message" | "cashAdjustment", value: string) => {
    setCounterDrafts((prev) => ({
      ...prev,
      [offerId]: {
        open: true,
        message: field === "message" ? value : (prev[offerId]?.message ?? ""),
        cashAdjustment: field === "cashAdjustment" ? value : (prev[offerId]?.cashAdjustment ?? "0"),
      },
    }));
  };

  const closeCounterDraft = (offerId: string) => {
    setCounterDrafts((prev) => ({
      ...prev,
      [offerId]: { open: false, message: prev[offerId]?.message ?? "", cashAdjustment: prev[offerId]?.cashAdjustment ?? "0" },
    }));
  };

  const submitCounter = async (offerId: string) => {
    const draft = counterDrafts[offerId];
    const cash = Number(draft?.cashAdjustment ?? "0");
    if (!Number.isFinite(cash)) {
      setError("Counter cash adjustment must be a number in cents.");
      return;
    }
    await updateOfferStatus(offerId, {
      status: "COUNTERED",
      message: draft?.message?.trim() || "",
      cashAdjustment: Math.trunc(cash),
    });
    closeCounterDraft(offerId);
  };

  if (loading) {
    return <CheckersLoader title="Loading trade..." compact />;
  }

  if (error && !post) {
    return (
      <PageContainer className="trade-detail-page app-page--trade-detail">
        <section className="app-section">
          <div>
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
          <div>
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
    return <CheckersLoader title="Loading trade..." compact />;
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
          <span className={`trade-status-chip ${postStatusClass(post.status)}`}>
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

        {error ? <p className="app-status-note is-error">{error}</p> : null}

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
                          className="trade-detail-gallery-img"
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
                      className={`app-chip${post.status === status ? " is-active" : ""}`}
                    >
                      {status.toLowerCase()}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {post.viewer.canOffer ? (
              <section className="product-card trade-detail-offer-panel">
                <SectionHeader title="Send offer" />
                <textarea
                  value={offerMessage}
                  onChange={(event) => setOfferMessage(event.target.value)}
                  className="trade-detail-textarea"
                  placeholder="Pitch your trade…"
                  rows={3}
                />
                <input
                  value={cashAdjustment}
                  onChange={(event) => setCashAdjustment(event.target.value)}
                  className="app-form-input"
                  inputMode="numeric"
                  placeholder="Cash sweetener (cents, +/-)"
                />
                {offerCards.map((card, index) => (
                  <div key={`${card.title}-${index}`} className="trade-detail-offer-card">
                    <div className="trade-detail-offer-card-row">
                      <input
                        value={card.title}
                        onChange={(event) => replaceOfferCard(index, "title", event.target.value)}
                        className="app-form-input"
                        placeholder="Card title"
                      />
                      {offerCards.length > 1 ? (
                        <button type="button" onClick={() => removeOfferCard(index)} className="trade-detail-remove">✕</button>
                      ) : null}
                    </div>
                    <div className="trade-detail-offer-grid">
                      <input value={card.cardSet} onChange={(event) => replaceOfferCard(index, "cardSet", event.target.value)} className="app-form-input" placeholder="Set" />
                      <input value={card.condition} onChange={(event) => replaceOfferCard(index, "condition", event.target.value)} className="app-form-input" placeholder="Condition" />
                      <input value={card.estimatedValue} onChange={(event) => replaceOfferCard(index, "estimatedValue", event.target.value)} className="app-form-input" inputMode="decimal" placeholder="Value (¢)" />
                      <input value={card.gradeLabel} onChange={(event) => replaceOfferCard(index, "gradeLabel", event.target.value)} className="app-form-input" placeholder="Grade" />
                    </div>
                  </div>
                ))}
                <div className="trade-detail-offer-actions">
                  <SecondaryButton onClick={addOfferCard}>+ Card</SecondaryButton>
                  <PrimaryButton onClick={() => void submitOffer()} disabled={submittingOffer}>
                    {submittingOffer ? "Sending…" : "Send offer"}
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
          <div className="app-status-note">No offers yet.</div>
        ) : (
          <div className="trade-offers-stack">
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
                  <div className="trade-offer-row-head">
                    <div>
                      <p className="trade-offer-proposer">
                        {offer.proposer.displayName ?? offer.proposer.username ?? "Member"}
                      </p>
                      <p className="trade-offer-timestamp">{formatTradeDateTime(offer.createdAt)}</p>
                    </div>
                    <span className={`trade-status-chip ${offerStatusClass(offer.status)}`}>
                      {offer.status}
                    </span>
                  </div>

                  {offer.message ? <p className="trade-offer-message">{offer.message}</p> : null}
                  <p className="trade-offer-meta">
                    Cash adjustment: {offer.cashAdjustment >= 0 ? "+" : ""}{offer.cashAdjustment} cents
                    {offer.cashAdjustment !== 0 ? ` (${formatCurrency(Math.abs(offer.cashAdjustment), "USD")})` : ""}
                  </p>

                  {hasDuelCounter ? (
                    <div className="trade-offer-duel-panel">
                      <div className="trade-offer-duel-head">
                        <div>
                          <p className="trade-offer-duel-eyebrow">Duel terms</p>
                          <p className="trade-offer-duel-title">
                            {duel?.mode ?? offer.gameType}
                          </p>
                        </div>
                        <span className={`trade-status-chip ${duelStatusClass(duelStatus)}`}>
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
                        <span className={`trade-status-chip ${ownerAgreed ? "is-open" : ""}`}>
                          Owner {ownerAgreed ? "ready" : "pending"}
                        </span>
                        <span className={`trade-status-chip ${proposerAgreed ? "is-open" : ""}`}>
                          Proposer {proposerAgreed ? "ready" : "pending"}
                        </span>
                      </div>
                      <div className="trade-offer-duel-actions">
                        {viewerCanAgreeTerms ? (
                          <button
                            type="button"
                            onClick={() => void agreeToDuelTerms(offer.id)}
                            disabled={actingOfferId === offer.id}
                            className="app-button app-button-secondary"
                          >
                            Approve duel
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => router.push(`/trades/${encodeURIComponent(post.id)}/duel?offer=${encodeURIComponent(offer.id)}`)}
                          className="app-button app-button-primary"
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
                    <div className="trade-offer-cards-grid">
                      {offer.cards.map((card) => (
                        <div key={card.id} className="trade-offer-card-item">
                          <p className="trade-offer-card-title">{card.title}</p>
                          <p className="trade-offer-card-meta">
                            {[card.cardSet, card.cardNumber, card.condition].filter(Boolean).join(" • ") || "No extra card details"}
                          </p>
                          {(card.gradeCompany || card.gradeLabel) ? (
                            <p className="trade-offer-card-meta">
                              {[card.gradeCompany, card.gradeLabel].filter(Boolean).join(" ")}
                            </p>
                          ) : null}
                          {card.estimatedValue ? (
                            <p className="trade-offer-card-meta">Est: {formatCurrency(card.estimatedValue, "USD")}</p>
                          ) : null}
                          {card.notes ? <p className="trade-offer-card-meta">{card.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {settlement ? (
                    <div className="trade-settlement-panel">
                      <div className="trade-settlement-head">
                        <p className="app-eyebrow">Cash settlement</p>
                        <span className={`trade-status-chip ${settlementStatusClass(settlement.status)}`}>
                          {settlement.status}
                        </span>
                      </div>
                      <p className="trade-settlement-amount">
                        {formatCurrency(settlement.amount, (settlement.currency || "usd").toUpperCase())}
                      </p>
                      <p className="trade-offer-meta">
                        {settlement.payer.displayName ?? settlement.payer.username ?? "Payer"} pays {settlement.payee.displayName ?? settlement.payee.username ?? "Payee"}
                      </p>
                      {settlement.status === "SUCCEEDED" ? (
                        <p className="app-status-note is-success">Payment completed.</p>
                      ) : canPaySettlement ? (
                        <button
                          type="button"
                          onClick={() => void startCheckout(offer.id)}
                          disabled={startingCheckoutOfferId === offer.id}
                          className="app-button app-button-primary"
                        >
                          {startingCheckoutOfferId === offer.id ? "Opening checkout..." : "Pay with Stripe"}
                        </button>
                      ) : (
                        <p className="trade-offer-meta">Waiting on payer to complete Stripe checkout.</p>
                      )}
                    </div>
                  ) : null}

                  {canAccept || canDecline ? (
                    <div className="trade-offer-actions">
                      {canAccept ? (
                        <button
                          type="button"
                          onClick={() => void updateOfferStatus(offer.id, { status: "ACCEPTED" })}
                          disabled={actingOfferId === offer.id}
                          className="app-button app-button-primary"
                        >
                          Accept
                        </button>
                      ) : null}
                      {canCounter ? (
                        <button
                          type="button"
                          onClick={() => openCounterDraft(offer)}
                          disabled={actingOfferId === offer.id}
                          className="app-button app-button-secondary"
                        >
                          Counter
                        </button>
                      ) : null}
                      {canDecline ? (
                        <button
                          type="button"
                          onClick={() => void updateOfferStatus(offer.id, { status: "DECLINED" })}
                          disabled={actingOfferId === offer.id}
                          className="app-button app-button-danger"
                        >
                          Decline
                        </button>
                      ) : null}
                    </div>
                  ) : canWithdraw ? (
                    <div className="trade-offer-actions">
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, { status: "WITHDRAWN" })}
                        disabled={actingOfferId === offer.id}
                        className="app-button app-button-danger"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : null}

                  {counterDraft?.open ? (
                    <div className="trade-counter-panel">
                      <p className="app-eyebrow">Counter offer</p>
                      <textarea
                        value={counterDraft.message}
                        onChange={(event) => setCounterField(offer.id, "message", event.target.value)}
                        className="app-form-textarea"
                        placeholder="Counter message…"
                        rows={2}
                      />
                      <input
                        value={counterDraft.cashAdjustment}
                        onChange={(event) => setCounterField(offer.id, "cashAdjustment", event.target.value)}
                        className="app-form-input"
                        inputMode="numeric"
                        placeholder="Cash adjustment (cents)"
                      />
                      <div className="trade-counter-actions">
                        <button
                          type="button"
                          onClick={() => void submitCounter(offer.id)}
                          disabled={actingOfferId === offer.id}
                          className="app-button app-button-primary"
                        >
                          Send counter
                        </button>
                        <button
                          type="button"
                          onClick={() => closeCounterDraft(offer.id)}
                          className="app-button app-button-secondary"
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
