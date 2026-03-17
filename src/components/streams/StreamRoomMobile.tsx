"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { SegmentedControl } from "@/components/product/ProductUI";
import { ListingImageStrip } from "@/components/streams/ListingImageStrip";
import { LiveKitStream } from "@/components/streams/LiveKitStream";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";

type StreamRoomMobileProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

type MobileTab = "chat" | "bids" | "details";

const MOBILE_TABS: Array<{ value: MobileTab; label: string }> = [
  { value: "chat", label: "Chat" },
  { value: "bids", label: "Bids" },
  { value: "details", label: "Details" },
];

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
  const [bidAmount, setBidAmount] = useState("");
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");

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
    () => [
      minimumBid,
      minimumBid + (data?.minBidIncrement ?? 0) * 2,
      minimumBid + (data?.minBidIncrement ?? 0) * 5,
    ],
    [data?.minBidIncrement, minimumBid],
  );

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
    setBidAmount(((amount + data.minBidIncrement) / 100).toFixed(2));
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
    void refresh();
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
    <section className="stream-room-mobile">
      <section className="stream-room-mobile-video">
        <div className="stream-room-mobile-stage">
          <LiveKitStream
            auctionId={data.id}
            isHost={Boolean(sessionUserId && data.seller?.user?.id === sessionUserId)}
            fallbackImageUrl={data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null}
            fallbackVideoUrl={data.videoStreamUrl}
            onParticipantCount={setParticipantCount}
            onStatusChange={setStreamStatus}
          />
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            {!Boolean(sessionUserId && data.seller?.user?.id === sessionUserId) ? (
              <span className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${streamStatus === "live" ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white"}`}>
                {streamStatus === "live" ? "Live" : "Offline"}
              </span>
            ) : null}
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs text-white">
              {formatSeconds(timeLeft)}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-[24px] bg-slate-950/55 px-4 py-3 text-white backdrop-blur">
            <p className="font-display text-2xl leading-tight">{data.title}</p>
            <p className="mt-1 text-sm text-white/72">
              {data.seller?.user?.displayName ?? "Verified seller"} · {(participantCount ?? data.watchersCount)} watching
            </p>
          </div>
        </div>
      </section>

      <SegmentedControl
        options={MOBILE_TABS}
        value={activeTab}
        onChange={(value) => setActiveTab(value)}
        className="stream-room-mobile-tabs"
      />

      <section className="stream-room-mobile-panel">
        {activeTab === "chat" ? (
          <div className="stream-room-mobile-tab stream-room-mobile-chat">
            <div className="stream-room-mobile-section-head">
              <h3>Chat</h3>
              <span>{data.chatMessages.length} messages</span>
            </div>
            <div className="stream-room-mobile-feed">
              {data.chatMessages.length === 0 ? (
                <div className="ios-empty">No chat yet. Be first to comment.</div>
              ) : (
                data.chatMessages.map((entry) => (
                  <div key={entry.id} className="stream-room-mobile-message">
                    <span>{entry.sender.displayName ?? "Guest"}</span>
                    <p>{entry.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="stream-room-mobile-compose">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message the room"
                className="ios-input"
              />
              <button
                onClick={handleSend}
                className="app-button app-button-primary"
              >
                Send
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "bids" ? (
          <div className="stream-room-mobile-tab stream-room-mobile-bids">
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
            {data.listingType !== "BUY_NOW" ? (
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
                        setBidAmount((amount / 100).toFixed(2));
                        void handleBid(amount);
                      }}
                      className="stream-bid-quick-btn"
                    >
                      {formatCurrency(amount, currency)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="stream-room-mobile-actions">
              {data.listingType !== "BUY_NOW" ? (
                <button
                  onClick={() => void handleBid()}
                  disabled={isListingSeller || !canUseStripe || !roomLive}
                  className="app-button app-button-primary"
                >
                  Bid {formatCurrency(validBidAmount, currency)}
                </button>
              ) : null}
              {data.listingType !== "AUCTION" && data.buyNowPrice ? (
                <button
                  onClick={handleBuyNow}
                  disabled={isListingSeller || !canUseStripe}
                  className="app-button app-button-secondary"
                >
                  Buy now {formatCurrency(data.buyNowPrice, currency)}
                </button>
              ) : null}
            </div>

            <div className="stream-room-mobile-section-head">
              <h3>Recent bids</h3>
              <span>{data.bids.length} bids</span>
            </div>
            <div className="stream-room-mobile-feed">
              {data.bids.length === 0 ? (
                <div className="ios-empty">No bids yet.</div>
              ) : (
                data.bids.map((bid) => (
                  <div key={bid.id} className="stream-room-mobile-bid-row">
                    <span>{bid.bidderId.slice(0, 6)}...</span>
                    <strong>{formatCurrency(bid.amount, currency)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "details" ? (
          <div className="stream-room-mobile-tab stream-room-mobile-details">
            <div className="stream-room-mobile-section-head">
              <h3>Details</h3>
              <span>{data.listingType.replace("_", " ")}</span>
            </div>
            <div className="stream-room-mobile-detail-grid">
              <div>
                <p>Seller</p>
                <strong>{data.seller?.user?.displayName ?? "Verified seller"}</strong>
              </div>
              <div>
                <p>Status</p>
                <strong>{roomLive ? "Live now" : "Waiting on host"}</strong>
              </div>
              <div>
                <p>Watching</p>
                <strong>{participantCount ?? data.watchersCount}</strong>
              </div>
              <div>
                <p>Current</p>
                <strong>{formatCurrency(data.currentBid, currency)}</strong>
              </div>
            </div>
            <ListingImageStrip images={data.item?.images ?? []} compact />
            <div className="stream-room-mobile-actions">
              <button
                onClick={handleMessageSeller}
                disabled={isListingSeller}
                className="app-button app-button-secondary"
              >
                Message seller
              </button>
            </div>
          </div>
        ) : null}

        {actionStatus ? <p className="stream-room-mobile-status">{actionStatus}</p> : null}
      </section>
    </section>
  );
}
