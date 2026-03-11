"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import {
  formatTradeDateTime,
  isValidImageUrl,
  toTagArray,
  tradeValueLabel,
  type TradeGameType,
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
  resolution: "STANDARD" | "GAME";
  gameType: TradeGameType;
  gameTerms: string;
};

const GAME_OPTIONS: Array<{ value: TradeGameType; label: string }> = [
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

export default function TradeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const postId = useMemo(() => (Array.isArray(params.id) ? params.id[0] : params.id), [params.id]);

  const [post, setPost] = useState<TradePostDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const response = await fetchClientApi(`/api/trades/${encodedPostId}`, { cache: "no-store" });
      const payload = (await response.json()) as TradePostDetail & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load trade.");
      }
      setPost(payload);
      if (!options?.silent) {
        setLoading(false);
      }
    } catch (err) {
      setError(normalizeClientError(err, "Unable to load trade."));
      if (!options?.silent) {
        setLoading(false);
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
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to update status.");
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
      counterMode?: "STANDARD" | "GAME";
      gameType?: TradeGameType;
      gameTerms?: string;
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
      const responsePayload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(responsePayload.error || "Unable to update offer.");
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

  const agreeToGameTerms = async (offerId: string) => {
    await updateOfferStatus(offerId, { gameAction: "AGREE_TERMS" });
  };

  const startGameSession = async (offerId: string) => {
    return updateOfferStatus(offerId, { gameAction: "START_GAME" });
  };

  const startCheckout = async (offerId: string) => {
    setStartingCheckoutOfferId(offerId);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/offers/${offerId}/checkout`, {
        method: "POST",
      });
      const payload = (await response.json()) as { checkoutUrl?: string | null; error?: string; paid?: boolean };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to start settlement checkout.");
      }
      if (payload.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      if (payload.checkoutUrl) {
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
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to submit offer.");
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
        resolution: offer.gameType ? "GAME" : "STANDARD",
        gameType: offer.gameType ?? "checkers",
        gameTerms: offer.gameTerms ?? "Winner takes the trade rights for this offer.",
      },
    }));
  };

  const setCounterField = (
    offerId: string,
    field: "message" | "cashAdjustment" | "resolution" | "gameType" | "gameTerms",
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
          gameType: prev[offerId]?.gameType ?? "checkers",
          gameTerms: prev[offerId]?.gameTerms ?? "Winner takes the trade rights for this offer.",
        };

        if (field === "message") return { ...base, message: value };
        if (field === "cashAdjustment") return { ...base, cashAdjustment: value };
        if (field === "resolution") {
          return { ...base, resolution: value === "GAME" ? "GAME" : "STANDARD" };
        }
        if (field === "gameType") {
          const nextGameType = GAME_OPTIONS.some((entry) => entry.value === value)
            ? (value as TradeGameType)
            : base.gameType;
          return { ...base, gameType: nextGameType };
        }
        return { ...base, gameTerms: value };
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
        gameType: prev[offerId]?.gameType ?? "checkers",
        gameTerms: prev[offerId]?.gameTerms ?? "Winner takes the trade rights for this offer.",
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
    if (draft?.resolution === "GAME") {
      if (!draft.gameTerms.trim() || draft.gameTerms.trim().length < 12) {
        setError("Game terms must be at least 12 characters.");
        return;
      }
    }

    await updateOfferStatus(offerId, {
      status: "COUNTERED",
      message: draft?.message?.trim() || "",
      cashAdjustment: Math.trunc(cash),
      counterMode: draft?.resolution ?? "STANDARD",
      gameType: draft?.gameType,
      gameTerms: draft?.gameTerms?.trim(),
    });

    closeCounterDraft(offerId);
  };

  if (loading) {
    return <CheckersLoader title="Loading trade..." compact className="ios-empty" />;
  }

  if (!post) {
    return <div className="ios-empty">Trade not found.</div>;
  }

  const tags = toTagArray(post.tags);
  const currentUserId = session?.user?.id ?? "";

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${postStatusClass(post.status)}`}>
                {post.status}
              </span>
              <span className="text-xs text-slate-500">{formatTradeDateTime(post.createdAt)}</span>
            </div>
            <h1 className="mt-2 ios-title">{post.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              by {post.owner.displayName ?? post.owner.username ?? "Member"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/trades"
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
            >
              Back
            </Link>
            {post.viewer.isOwner ? (
              <button
                type="button"
                onClick={() => router.push("/trades/new")}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                New post
              </button>
            ) : null}
          </div>
        </div>

        <div className="ios-panel p-4">
          <p className="text-sm text-slate-700">{post.lookingFor}</p>
          {post.description ? <p className="mt-2 text-sm text-slate-600">{post.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{tradeValueLabel(post.valueMin, post.valueMax)}</span>
            <span>•</span>
            <span>{post._count.offers} offers</span>
            {post.shippingMode ? (
              <>
                <span>•</span>
                <span>{post.shippingMode}</span>
              </>
            ) : null}
            {post.location ? (
              <>
                <span>•</span>
                <span>{post.location}</span>
              </>
            ) : null}
          </div>
          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {post.viewer.isOwner ? (
          <div className="ios-panel p-4">
            <div className="flex flex-wrap gap-2">
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
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="ios-panel p-4">
          <h2 className="ios-section-title">Card view</h2>
          {post.images.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {post.images.map((image) => {
                const canRender = isValidImageUrl(image.url);
                return (
                  <div key={image.id} className="relative h-56 overflow-hidden rounded-2xl border border-white/70 bg-white/70">
                    {canRender ? (
                      <img
                        src={image.url}
                        alt={post.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-400">
                        Image unavailable
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative mt-3 h-56 overflow-hidden rounded-2xl border border-white/70 bg-white/70">
              <Image
                src={resolveDisplayMediaUrl(null)}
                alt="Card placeholder"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          )}
        </div>

        {post.viewer.canOffer ? (
          <div className="ios-panel p-4">
            <h2 className="ios-section-title">Send offer</h2>
            <textarea
              value={offerMessage}
              onChange={(event) => setOfferMessage(event.target.value)}
              className="mt-3 min-h-24 w-full rounded-3xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="Trade pitch"
            />
            <input
              value={cashAdjustment}
              onChange={(event) => setCashAdjustment(event.target.value)}
              className="ios-input mt-3"
              inputMode="numeric"
              placeholder="Cash adjustment in cents (+/-)"
            />
            <div className="mt-3 space-y-2">
              {offerCards.map((card, index) => (
                <div key={`${card.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                  <input
                    value={card.title}
                    onChange={(event) => replaceOfferCard(index, "title", event.target.value)}
                    className="ios-input"
                    placeholder="Offered card title"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                    className="ios-input mt-2"
                    placeholder="Notes"
                  />
                  {offerCards.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeOfferCard(index)}
                      className="mt-2 rounded-full border border-red-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700"
                    >
                      Remove card
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addOfferCard}
                className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                Add card
              </button>
              <button
                type="button"
                onClick={() => void submitOffer()}
                disabled={submittingOffer}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
              >
                {submittingOffer ? "Sending..." : "Submit offer"}
              </button>
            </div>
          </div>
        ) : !session?.user?.id ? (
          <div className="ios-panel p-4">
            <h2 className="ios-section-title">Send offer</h2>
            <p className="mt-2 text-sm text-slate-600">Sign in to trade.</p>
            <button
              type="button"
              onClick={() => signIn()}
              className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          </div>
        ) : null}
      </section>

      <section className="ios-panel p-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="ios-section-title">Offers</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{post.offers.length}</p>
        </div>

        {post.offers.length === 0 ? (
          <div className="ios-empty mt-3">No offers yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {post.offers.map((offer) => {
              const viewerIsProposer = offer.proposerId === currentUserId;
              const activeOffer = ["PENDING", "COUNTERED"].includes(offer.status);
              const canDecline = activeOffer && post.viewer.isOwner;
              const canCounter = activeOffer
                && (post.viewer.isOwner || viewerIsProposer)
                && (offer.status === "PENDING" ? post.viewer.isOwner : offer.gameProposedById !== currentUserId);
              const canWithdraw = viewerIsProposer && activeOffer;
              const counterDraft = counterDrafts[offer.id];
              const settlement = offer.settlement;
              const isSettlementPayer = settlement?.payerId === currentUserId;
              const canPaySettlement = offer.status === "ACCEPTED" && settlement && settlement.status !== "SUCCEEDED" && isSettlementPayer;
              const hasGameCounter = offer.status === "COUNTERED" && Boolean(offer.gameType && offer.gameTerms);
              const canAccept = activeOffer
                && !hasGameCounter
                && (post.viewer.isOwner || (viewerIsProposer && offer.status === "COUNTERED"));
              const ownerAgreed = Boolean(offer.gameOwnerAgreedAt);
              const proposerAgreed = Boolean(offer.gameProposerAgreedAt);
              const bothAgreed = ownerAgreed && proposerAgreed;
              const viewerCanAgreeTerms = hasGameCounter && (
                (post.viewer.isOwner && !ownerAgreed)
                || (viewerIsProposer && !proposerAgreed)
              );
              const viewerCanStartGame = hasGameCounter && bothAgreed;

              return (
                <div
                  key={offer.id}
                  className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
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

                  {hasGameCounter ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Game terms</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {GAME_OPTIONS.find((entry) => entry.value === offer.gameType)?.label ?? offer.gameType}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{offer.gameTerms}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em]">
                        <span className={`rounded-full border px-2 py-1 ${ownerAgreed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                          Owner {ownerAgreed ? "agreed" : "pending"}
                        </span>
                        <span className={`rounded-full border px-2 py-1 ${proposerAgreed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                          Proposer {proposerAgreed ? "agreed" : "pending"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {viewerCanAgreeTerms ? (
                          <button
                            type="button"
                            onClick={() => void agreeToGameTerms(offer.id)}
                            disabled={actingOfferId === offer.id}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-60"
                          >
                            Agree to terms
                          </button>
                        ) : null}
                        {viewerCanStartGame ? (
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                const started = await startGameSession(offer.id);
                                if (!started) return;
                                router.push(`/trades/${encodeURIComponent(post.id)}/dispute?offer=${encodeURIComponent(offer.id)}`);
                              })();
                            }}
                            disabled={actingOfferId === offer.id}
                            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                          >
                            Play game
                          </button>
                        ) : (
                          <span className="self-center text-xs text-slate-500">
                            Game unlocks after both approvals.
                          </span>
                        )}
                      </div>
                      {offer.gameResolvedAt && offer.gameWinnerId ? (
                        <p className="mt-2 text-xs text-emerald-700">
                          Game settled. Winner: {offer.gameWinnerId === offer.proposerId ? "Proposer" : "Owner"}.
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
                          <option value="GAME">Counter + play game</option>
                        </select>
                        {counterDraft.resolution === "GAME" ? (
                          <select
                            value={counterDraft.gameType}
                            onChange={(event) => setCounterField(offer.id, "gameType", event.target.value)}
                            className="ios-input"
                          >
                            {GAME_OPTIONS.map((entry) => (
                              <option key={entry.value} value={entry.value}>{entry.label}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      {counterDraft.resolution === "GAME" ? (
                        <textarea
                          value={counterDraft.gameTerms}
                          onChange={(event) => setCounterField(offer.id, "gameTerms", event.target.value)}
                          className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                          placeholder="Game terms (who plays, winner outcome, rematch rules)"
                        />
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
    </div>
  );
}
