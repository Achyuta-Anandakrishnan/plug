"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { LiveKitStream } from "@/components/streams/LiveKitStream";

type StreamRoomMobileProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

export function StreamRoomMobile({
  auctionId,
  initialData,
  stripeEnabled = true,
}: StreamRoomMobileProps) {
  const router = useRouter();
  const { data, loading, error, refresh } = useAuction(
    auctionId,
    5000,
    initialData,
  );
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";
  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");

  const timeLeft = useMemo(() => {
    if (!data) return 0;
    return getTimeLeftSeconds(data);
  }, [data]);

  const nextBid = data ? data.currentBid + data.minBidIncrement : 0;
  const currency = data?.currency?.toUpperCase() ?? "USD";
  const effectiveBuyerId = sessionUserId;
  const isAdmin = session?.user?.role === "ADMIN";
  const isHost = Boolean(
    sessionUserId &&
      data?.seller?.user?.id &&
      (data.seller.user.id === sessionUserId || isAdmin),
  );
  const isListingSeller =
    Boolean(sessionUserId && data?.seller?.user?.id) &&
    data?.seller?.user?.id === sessionUserId;
  const canUseStripe = Boolean(stripeEnabled);

  const handleMessageSeller = async () => {
    if (!data) return;
    if (!sessionUserId) {
      await signIn();
      return;
    }
    const sellerUserId = data.seller?.user?.id ?? "";
    if (!sellerUserId) return;
    if (sellerUserId === sessionUserId) return;

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: `auction:${data.id}`,
        participantIds: [sessionUserId, sellerUserId],
      }),
    });
    const payload = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !payload?.id) {
      setActionStatus(payload.error || "Unable to start a conversation.");
      return;
    }
    router.push(`/messages?c=${encodeURIComponent(payload.id)}`);
  };

  const handleBid = async () => {
    if (!data) return;
    if (!canUseStripe) {
      setActionStatus("Connect Stripe to place offers.");
      return;
    }
    if (!effectiveBuyerId) {
      setActionStatus("Sign in to place bids.");
      await signIn();
      return;
    }
    if (isListingSeller) {
      setActionStatus("Sellers cannot bid on their own listings.");
      return;
    }
    const confirmBid = window.confirm(
      `Place bid for ${formatCurrency(nextBid, currency)}?`,
    );
    if (!confirmBid) return;
    const response = await fetch(`/api/auctions/${data.id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: nextBid }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setActionStatus(payload.error || "Unable to place bid.");
      return;
    }
    setActionStatus("Bid placed.");
    refresh();
  };

  const handleBuyNow = async () => {
    if (!data) return;
    if (!canUseStripe) {
      setActionStatus("Connect Stripe to buy now.");
      return;
    }
    if (!effectiveBuyerId) {
      setActionStatus("Sign in to buy now.");
      await signIn();
      return;
    }
    if (isListingSeller) {
      setActionStatus("Sellers cannot buy their own listings.");
      return;
    }
    const confirmBuy = window.confirm(
      `Confirm buy now for ${formatCurrency(data.buyNowPrice ?? 0, currency)}?`,
    );
    if (!confirmBuy) return;
    const response = await fetch(`/api/auctions/${data.id}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setActionStatus(payload.error || "Unable to buy now.");
      return;
    }
    setActionStatus("Buy now initiated.");
  };

  const handleSend = async () => {
    if (!data || !message.trim()) return;
    if (!effectiveBuyerId) {
      setActionStatus("Sign in to chat.");
      await signIn();
      return;
    }
    const response = await fetch(`/api/auctions/${data.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: message,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setActionStatus(payload.error || "Unable to send message.");
      return;
    }
    setMessage("");
    refresh();
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
        Loading stream room...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Unable to load listing."}
      </div>
    );
  }

  const imageUrl = data.item?.images?.find((img) => img.isPrimary)?.url
    ?? data.item?.images?.[0]?.url
    ?? null;

  return (
    <div className="space-y-5">
      {isHost && streamStatus !== "live" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {streamStatus === "connecting"
            ? "Connecting to LiveKit..."
            : "You're not live yet. Tap Go live to start streaming."}
        </div>
      )}
      <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/80">
        <div className="relative h-56 bg-slate-900">
          <LiveKitStream
            auctionId={data.id}
            isHost={isHost}
            fallbackImageUrl={imageUrl}
            fallbackVideoUrl={data.videoStreamUrl}
            onParticipantCount={setParticipantCount}
            onStatusChange={setStreamStatus}
          />
          {!isHost && (
            <div
              className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                streamStatus === "live"
                  ? "bg-emerald-400/20 text-emerald-100"
                  : "bg-white/15 text-white"
              }`}
            >
              {streamStatus === "live" ? "Live" : "Offline"}
            </div>
          )}
          {imageUrl && (
            <div className="relative absolute right-4 top-4 h-12 w-16 overflow-hidden rounded-xl border border-white/30 bg-white/10">
              <Image src={imageUrl} alt={data.title} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 space-y-1 text-white">
            <p className="font-display text-xl">{data.title}</p>
            <p className="text-xs text-white/70">
              {data.seller?.user?.displayName ?? "Verified seller"} ·{" "}
              {data.category?.name ?? "Collectible"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
          <span>{(participantCount ?? data.watchersCount)} watching</span>
          <span>{formatSeconds(timeLeft)} left</span>
        </div>
      </section>

      <section className="surface-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Current bid</span>
          <span className="font-display text-lg text-slate-900">
            {formatCurrency(data.currentBid, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Min increment</span>
          <span>{formatCurrency(data.minBidIncrement, currency)}</span>
        </div>
        <div className="grid gap-2">
          {data.listingType !== "BUY_NOW" && (
            <button
              onClick={handleBid}
              disabled={isListingSeller || !canUseStripe}
              className="rounded-full bg-[var(--royal)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              Bid {formatCurrency(nextBid, currency)}
            </button>
          )}
          {data.listingType !== "AUCTION" && data.buyNowPrice && (
            <button
              onClick={handleBuyNow}
              disabled={isListingSeller || !canUseStripe}
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Buy now {formatCurrency(data.buyNowPrice, currency)}
            </button>
          )}
          <button
            onClick={handleMessageSeller}
            disabled={isListingSeller}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Message seller
          </button>
        </div>
        {!canUseStripe && (
          <p className="text-xs text-amber-700">
            Stripe must be connected to place offers or buy now.
          </p>
        )}
        {isListingSeller && (
          <p className="text-xs text-amber-700">
            Sellers cannot bid or buy their own listings.
          </p>
        )}
      </section>

      <section className="surface-panel rounded-3xl p-4 space-y-3">
        <h3 className="font-display text-lg text-slate-900">Buyer identity</h3>
        {sessionUserId ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {session?.user?.email ??
              session?.user?.name ??
              "Authenticated buyer"}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn()}
            className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Sign in to bid, buy, and chat
          </button>
        )}
        {actionStatus && (
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-xs text-slate-600">
            {actionStatus}
          </div>
        )}
      </section>

      <section className="surface-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-slate-900">Chat</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Live
          </span>
        </div>
        <div className="space-y-3 text-sm text-slate-600">
          {data.chatMessages.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-2xl px-3 py-2 ${
                entry.senderId === sessionUserId
                  ? "ml-auto bg-[var(--royal)]/10 text-slate-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span className="block text-xs font-semibold text-slate-500">
                {entry.sender.displayName ?? "Guest"}
              </span>
              <span>{entry.body}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Message the room"
            className="flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
          />
          <button
            onClick={handleSend}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Send
          </button>
        </div>
      </section>

      <section className="surface-panel rounded-3xl p-4 space-y-3">
        <h3 className="font-display text-lg text-slate-900">Recent bids</h3>
        <div className="space-y-2 text-sm text-slate-600">
          {data.bids.map((bid) => (
            <div
              key={bid.id}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-3 py-2"
            >
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {bid.bidderId.slice(0, 6)}...
              </span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(bid.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
