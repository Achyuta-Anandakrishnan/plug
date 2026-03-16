"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveKitStream } from "@/components/streams/LiveKitStream";
import { ListingImageStrip } from "@/components/streams/ListingImageStrip";

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
  const { data, loading, error, refresh } = useAuction(auctionId, 5000, initialData);
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";

  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [chatOpen, setChatOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  const timeLeft = useMemo(() => (data ? getTimeLeftSeconds(data) : 0), [data]);

  const nextBid = data ? data.currentBid + data.minBidIncrement : 0;
  const currency = data?.currency?.toUpperCase() ?? "USD";
  const effectiveBuyerId = sessionUserId;
  const isListingSeller =
    Boolean(sessionUserId && data?.seller?.user?.id) && data?.seller?.user?.id === sessionUserId;
  const canUseStripe = Boolean(stripeEnabled);
  const roomLive = streamStatus === "live" || (data?.status === "LIVE" && timeLeft > 0);
  const parsedBidAmount = Number(bidAmount);
  const minimumBid = nextBid;
  const validBidAmount = Number.isFinite(parsedBidAmount) ? Math.round(parsedBidAmount * 100) : minimumBid;
  const quickBidOptions = useMemo(
    () => [minimumBid, minimumBid + (data?.minBidIncrement ?? 0) * 2, minimumBid + (data?.minBidIncrement ?? 0) * 5],
    [data?.minBidIncrement, minimumBid],
  );

  useEffect(() => {
    document.body.style.overflow = chatOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [chatOpen]);

  useEffect(() => {
    setBidAmount((minimumBid / 100).toFixed(2));
  }, [minimumBid]);

  const handleMessageSeller = async () => {
    if (!data) return;
    if (!sessionUserId) {
      await signIn();
      return;
    }

    const sellerUserId = data.seller?.user?.id ?? "";
    if (!sellerUserId || sellerUserId === sessionUserId) return;

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

  const handleBid = async (amountOverride?: number) => {
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
    if (!roomLive) {
      setActionStatus("Bidding opens once the seller is live.");
      return;
    }
    const amount = amountOverride ?? validBidAmount;
    if (amount < minimumBid) {
      setActionStatus(`Enter at least ${formatCurrency(minimumBid, currency)}.`);
      return;
    }

    const response = await fetch(`/api/auctions/${data.id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setActionStatus(payload.error || "Unable to place bid.");
      return;
    }

    setActionStatus(`Bid placed at ${formatCurrency(amount, currency)}.`);
    setBidAmount(String(amount + data.minBidIncrement));
    void refresh({ poll: true });
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

    const response = await fetch(`/api/auctions/${data.id}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json() as { error?: string; checkoutUrl?: string | null };
    if (!response.ok) {
      setActionStatus(payload.error || "Unable to buy now.");
      return;
    }

    if (payload.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
      window.location.assign(payload.checkoutUrl);
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
      body: JSON.stringify({ body: message }),
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
    return <CheckersLoader title="Loading stream room..." compact className="ios-empty" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Unable to load listing."}
      </div>
    );
  }

  return (
    <div className="ios-screen">
      <section className="overflow-hidden rounded-[32px] border border-white/60 bg-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
        <div className="relative h-[18.5rem]">
          <LiveKitStream
            auctionId={data.id}
            isHost={Boolean(sessionUserId && data.seller?.user?.id === sessionUserId)}
            fallbackImageUrl={data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null}
            fallbackVideoUrl={data.videoStreamUrl}
            onParticipantCount={setParticipantCount}
            onStatusChange={setStreamStatus}
          />
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            {!Boolean(sessionUserId && data.seller?.user?.id === sessionUserId) && (
              <span className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${streamStatus === "live" ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white"}`}>
                {streamStatus === "live" ? "Live" : "Offline"}
              </span>
            )}
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs text-white">{formatSeconds(timeLeft)}</span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-[24px] bg-slate-950/55 px-4 py-3 text-white backdrop-blur">
            <p className="font-display text-2xl leading-tight">{data.title}</p>
            <p className="mt-1 text-sm text-white/72">
              {data.seller?.user?.displayName ?? "Verified seller"} · {(participantCount ?? data.watchersCount)} watching
            </p>
          </div>
        </div>
      </section>

      <ListingImageStrip images={data.item?.images ?? []} compact />

      <section className="ios-panel p-4 space-y-4">
        <div className="stream-bid-summary">
          <div>
            <p>Current</p>
            <strong>{formatCurrency(data.currentBid, currency)}</strong>
          </div>
          <div>
            <p>Minimum</p>
            <strong>{formatCurrency(minimumBid, currency)}</strong>
          </div>
          <div>
            <p>Closes in</p>
            <strong>{roomLive ? formatSeconds(timeLeft) : "Pending"}</strong>
          </div>
        </div>
        {data.listingType !== "BUY_NOW" && (
          <div className="stream-bid-panel">
            <label className="stream-bid-field">
              <span>Your bid</span>
              <input
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder={(minimumBid / 100).toFixed(2)}
              />
            </label>
            <div className="stream-bid-quick">
              {quickBidOptions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setBidAmount(String(amount));
                    void handleBid(amount);
                  }}
                  className="stream-bid-quick-btn"
                >
                  {formatCurrency(amount, currency)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-2">
          {data.listingType !== "BUY_NOW" && (
            <button
              onClick={() => void handleBid()}
              disabled={isListingSeller || !canUseStripe || !roomLive}
              className="rounded-full bg-[var(--royal)] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            >
              Bid {formatCurrency(validBidAmount, currency)}
            </button>
          )}
          {data.listingType !== "AUCTION" && data.buyNowPrice && (
            <button
              onClick={handleBuyNow}
              disabled={isListingSeller || !canUseStripe}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-3.5 text-base font-semibold text-slate-700 disabled:opacity-60"
            >
              Buy now {formatCurrency(data.buyNowPrice, currency)}
            </button>
          )}
          <button
            onClick={handleMessageSeller}
            disabled={isListingSeller}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-3.5 text-base font-semibold text-slate-700 disabled:opacity-60"
          >
            Message seller
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-3.5 text-base font-semibold text-slate-700"
          >
            Open chat
          </button>
        </div>
        {actionStatus && <p className="text-xs text-slate-600">{actionStatus}</p>}
      </section>

      {chatOpen && (
        <div className="fixed inset-0 z-[1200] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setChatOpen(false)}
            aria-label="Close chat"
          />
          <section className="absolute inset-x-0 bottom-0 top-[16vh] flex flex-col rounded-t-[28px] border border-white/60 bg-white/95 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-2xl text-slate-900">Chat</h3>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600">
              {data.chatMessages.length === 0 && (
                <div className="ios-empty">No chat yet. Be first to comment.</div>
              )}
              {data.chatMessages.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-slate-100 px-3 py-2">
                  <span className="block text-xs font-semibold text-slate-500">{entry.sender.displayName ?? "Guest"}</span>
                  {entry.body}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message the room"
                className="ios-input flex-1 text-sm"
              />
              <button
                onClick={handleSend}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="ios-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-2xl text-slate-900">Recent bids</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Scroll</span>
        </div>
        <div className="max-h-40 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600">
          {data.bids.length === 0 && (
            <div className="ios-empty">No bids yet.</div>
          )}
          {data.bids.map((bid) => (
            <div key={bid.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{bid.bidderId.slice(0, 6)}...</span>
              <span className="font-semibold text-slate-900">{formatCurrency(bid.amount, currency)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
