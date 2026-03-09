"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  formatTradeDateTime,
  toTagArray,
  tradeValueLabel,
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
  if (status === "MATCHED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PAUSED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

function offerStatusClass(status: TradeOfferItem["status"]) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DECLINED" || status === "WITHDRAWN") return "border-slate-200 bg-white text-slate-500";
  if (status === "COUNTERED") return "border-blue-200 bg-blue-50 text-blue-700";
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
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  const [cashAdjustment, setCashAdjustment] = useState("");
  const [offerCards, setOfferCards] = useState<OfferDraftCard[]>([{ ...emptyOfferCard }]);

  const refresh = async () => {
    if (!postId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/trades/${postId}`, { cache: "no-store" });
      const payload = (await response.json()) as TradePostDetail & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load trade.");
      }
      setPost(payload);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trade.");
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const updatePostStatus = async (status: TradePostDetail["status"]) => {
    if (!postId) return;
    setUpdatingStatus(true);
    setError("");
    try {
      const response = await fetch(`/api/trades/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to update status.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateOfferStatus = async (offerId: string, status: TradeOfferItem["status"]) => {
    setError("");
    try {
      const response = await fetch(`/api/trades/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to update offer.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update offer.");
    }
  };

  const submitOffer = async () => {
    if (!postId) return;
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
      const response = await fetch(`/api/trades/${postId}/offers`, {
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
      setError(err instanceof Error ? err.message : "Unable to submit offer.");
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

  if (loading) {
    return <div className="ios-empty">Loading trade...</div>;
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
              {post.images.map((image) => (
                <div key={image.id} className="relative h-56 overflow-hidden rounded-2xl border border-white/70 bg-white/70">
                  <Image src={image.url} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                </div>
              ))}
            </div>
          ) : (
            <div className="ios-empty mt-3">No images yet.</div>
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
              placeholder="Cash adjustment (+/-)"
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
                  <div className="mt-2 grid gap-2 grid-cols-2">
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
                      placeholder="Estimated value"
                    />
                  </div>
                  <div className="mt-2 grid gap-2 grid-cols-2">
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
              const canManage = post.viewer.isOwner && ["PENDING", "COUNTERED"].includes(offer.status);
              const canWithdraw = offer.proposerId === currentUserId && ["PENDING", "COUNTERED"].includes(offer.status);
              return (
                <div key={offer.id} className="rounded-3xl border border-slate-200 bg-white/90 p-4">
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
                  <p className="mt-2 text-xs text-slate-500">Cash adjustment: {offer.cashAdjustment >= 0 ? "+" : ""}{offer.cashAdjustment}</p>

                  {offer.cards.length > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {offer.cards.map((card) => (
                        <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[card.cardSet, card.cardNumber, card.condition].filter(Boolean).join(" • ")}
                          </p>
                          {card.estimatedValue ? (
                            <p className="mt-1 text-xs text-slate-500">Est: ${card.estimatedValue.toLocaleString()}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canManage ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, "ACCEPTED")}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, "COUNTERED")}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700"
                      >
                        Counter
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, "DECLINED")}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  ) : canWithdraw ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => void updateOfferStatus(offer.id, "WITHDRAWN")}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-700"
                      >
                        Withdraw
                      </button>
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
