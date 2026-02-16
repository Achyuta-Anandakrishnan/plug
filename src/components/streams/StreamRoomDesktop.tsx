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

type StreamRoomDesktopProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

export function StreamRoomDesktop({
  auctionId,
  initialData,
  stripeEnabled = true,
}: StreamRoomDesktopProps) {
  const router = useRouter();
  const { data, loading, error, refresh } = useAuction(
    auctionId,
    4000,
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
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {isHost && streamStatus !== "live" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            {streamStatus === "connecting"
              ? "Connecting to LiveKit..."
              : "You're not live yet. Click Go live to start streaming."}
          </div>
        )}
        <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
          <div className="relative h-[360px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
            <LiveKitStream
              auctionId={data.id}
              isHost={isHost}
              fallbackImageUrl={imageUrl}
              fallbackVideoUrl={data.videoStreamUrl}
              onParticipantCount={setParticipantCount}
              onStatusChange={setStreamStatus}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(27,77,255,0.3),_transparent_60%)]" />
            {!isHost && (
              <div className="absolute left-6 top-6 flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                    streamStatus === "live"
                      ? "bg-emerald-400/20 text-emerald-100"
                      : "bg-white/15 text-white"
                  }`}
                >
                  {streamStatus === "live" ? "Live" : "Offline"}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">
                  {data.listingType === "BUY_NOW" ? "Buy now" : "Auction"}
                </span>
              </div>
            )}
            <div className="absolute bottom-6 left-6 space-y-1 text-white">
              <p className="font-display text-2xl">{data.title}</p>
              <p className="text-sm text-white/70">
                {data.seller?.user?.displayName ?? "Verified seller"} ·{" "}
                {data.category?.name ?? "Collectible"}
              </p>
            </div>
            <div className="absolute bottom-6 right-6 grid gap-3">
              <div className="relative h-20 w-32 overflow-hidden rounded-2xl border border-white/30 bg-slate-900/70">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={data.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/30 bg-slate-900/70 px-3 py-2 text-xs text-white/70">
                Close-up
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/60 px-6 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              {(participantCount ?? data.watchersCount)} watching
            </div>
            <div className="flex items-center gap-4">
              <span>Escrow protected</span>
              <span>Verified seller</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="surface-panel rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Live price
            </p>
            <p className="font-display text-4xl text-slate-900">
              {formatCurrency(data.currentBid, currency)}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Min increment {formatCurrency(data.minBidIncrement, currency)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {data.listingType !== "BUY_NOW" && (
                <button
                  onClick={handleBid}
                  disabled={isListingSeller || !canUseStripe}
                  className="rounded-full bg-[var(--royal)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[var(--royal-deep)] disabled:opacity-60"
                >
                  Place bid {formatCurrency(nextBid, currency)}
                </button>
              )}
              {data.listingType !== "AUCTION" && data.buyNowPrice && (
                <button
                  onClick={handleBuyNow}
                  disabled={isListingSeller || !canUseStripe}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Buy now {formatCurrency(data.buyNowPrice, currency)}
                </button>
              )}
              <button
                onClick={handleMessageSeller}
                disabled={isListingSeller}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Message seller
              </button>
            </div>
            {!canUseStripe && (
              <p className="mt-3 text-xs text-amber-700">
                Stripe must be connected to place offers or buy now.
              </p>
            )}
            {isListingSeller && (
              <p className="mt-3 text-xs text-amber-700">
                Sellers cannot bid or buy their own listings.
              </p>
            )}
          </div>

          <div className="glass-panel rounded-[28px] p-5 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Time left
            </p>
            <p className="font-display text-4xl text-[var(--royal)]">
              {formatSeconds(timeLeft)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Each offer adds +{data.antiSnipeSeconds}s (anti-snipe)
            </p>
            <div className="mt-4 rounded-2xl bg-white/70 px-3 py-2 text-xs text-slate-600">
              {data.bids.length} verified offers
            </div>
          </div>
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <h3 className="font-display text-xl text-slate-900">
            Buyer protection built in
          </h3>
          <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-800">Manual vetting</p>
              <p>Seller interviews, inventory audits, and ID verification.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Escrow control</p>
              <p>Funds held until delivery + authenticity confirmation.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Claims desk</p>
              <p>Dispute resolution with on-stream recording log.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Buyer identity</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {sessionUserId ? "Signed in" : "Sign in required"}
            </span>
          </div>
          {sessionUserId ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              {session?.user?.email ?? session?.user?.name ?? "Authenticated buyer"}
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => signIn()}
                className="rounded-full bg-slate-900 px-4 py-3 text-xs font-semibold text-white"
              >
                Sign in to bid, buy, and chat
              </button>
            </div>
          )}
          {actionStatus && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-xs text-slate-600">
              {actionStatus}
            </div>
          )}
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Live chat</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Moderated
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
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
          <div className="mt-4 flex items-center gap-2">
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
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Offer stack</h3>
            <span className="text-xs text-slate-400">Live order</span>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {data.bids.map((bid) => (
              <div
                key={bid.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {bid.bidderId.slice(0, 6)}...
                  </p>
                  <p className="font-display text-lg text-slate-900">
                    {formatCurrency(bid.amount, currency)}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(bid.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
