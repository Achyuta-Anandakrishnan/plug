"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { CheckersLoader } from "@/components/CheckersLoader";
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
  const chatRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refresh } = useAuction(auctionId, 4000, initialData);
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";

  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [bidAmount, setBidAmount] = useState("");

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [data?.chatMessages]);

  const timeLeft = useMemo(() => (data ? getTimeLeftSeconds(data) : 0), [data]);
  const nextBid = data ? data.currentBid + data.minBidIncrement : 0;
  const currency = data?.currency?.toUpperCase() ?? "USD";
  const isAdmin = session?.user?.role === "ADMIN";
  const isHost = Boolean(
    sessionUserId
      && data?.seller?.user?.id
      && (data.seller.user.id === sessionUserId || isAdmin),
  );
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
    setBidAmount((minimumBid / 100).toFixed(2));
  }, [minimumBid]);

  const handleMessageSeller = async () => {
    if (!data) return;
    if (!sessionUserId) { await signIn(); return; }
    const sellerUserId = data.seller?.user?.id ?? "";
    if (!sellerUserId || sellerUserId === sessionUserId) return;
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: `auction:${data.id}`, participantIds: [sessionUserId, sellerUserId] }),
    });
    const payload = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !payload?.id) { setActionStatus(payload.error || "Unable to start a conversation."); return; }
    router.push(`/messages?c=${encodeURIComponent(payload.id)}`);
  };

  const handleBid = async (amountOverride?: number) => {
    if (!data) return;
    if (!canUseStripe) { setActionStatus("Connect Stripe to place offers."); return; }
    if (!sessionUserId) { setActionStatus("Sign in to place bids."); await signIn(); return; }
    if (isListingSeller) { setActionStatus("Sellers cannot bid on their own listings."); return; }
    if (!roomLive) { setActionStatus("Bidding opens once the seller is live."); return; }
    const amount = amountOverride ?? validBidAmount;
    if (amount < minimumBid) { setActionStatus(`Enter at least ${formatCurrency(minimumBid, currency)}.`); return; }
    const response = await fetch(`/api/auctions/${data.id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const payload = await response.json();
    if (!response.ok) { setActionStatus(payload.error || "Unable to place bid."); return; }
    setActionStatus(`Bid placed at ${formatCurrency(amount, currency)}.`);
    setBidAmount(((amount + data.minBidIncrement) / 100).toFixed(2));
    void refresh({ poll: true });
  };

  const handleBuyNow = async () => {
    if (!data) return;
    if (!canUseStripe) { setActionStatus("Connect Stripe to buy now."); return; }
    if (!sessionUserId) { setActionStatus("Sign in to buy now."); await signIn(); return; }
    if (isListingSeller) { setActionStatus("Sellers cannot buy their own listings."); return; }
    const confirmBuy = window.confirm(`Confirm buy now for ${formatCurrency(data.buyNowPrice ?? 0, currency)}?`);
    if (!confirmBuy) return;
    const response = await fetch(`/api/auctions/${data.id}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = (await response.json()) as { error?: string; checkoutUrl?: string | null };
    if (!response.ok) { setActionStatus(payload.error || "Unable to buy now."); return; }
    if (payload.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
      window.location.assign(payload.checkoutUrl);
      return;
    }
    setActionStatus("Buy now initiated.");
  };

  const handleSend = async () => {
    if (!data || !message.trim()) return;
    if (!sessionUserId) { setActionStatus("Sign in to chat."); await signIn(); return; }
    const response = await fetch(`/api/auctions/${data.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: message }),
    });
    const payload = await response.json();
    if (!response.ok) { setActionStatus(payload.error || "Unable to send message."); return; }
    setMessage("");
    refresh();
  };

  if (loading) {
    return (
      <div className="stream-room-empty">
        <CheckersLoader title="Loading stream room..." compact />
      </div>
    );
  }

  if (error || !data) {
    return <p className="app-status-note is-error">{error || "Unable to load listing."}</p>;
  }

  const imageUrl = data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null;

  return (
    <section className="stream-room-wn-shell">
      {/* ── Video ─────────────────────────────────────────────── */}
      <div className="stream-room-wn-video">
        <LiveKitStream
          auctionId={data.id}
          isHost={isHost}
          fallbackImageUrl={imageUrl}
          fallbackVideoUrl={data.videoStreamUrl}
          onParticipantCount={setParticipantCount}
          onStatusChange={setStreamStatus}
        />

        <div className="stream-room-wn-grad-top" aria-hidden />
        <div className="stream-room-wn-grad-bottom" aria-hidden />

        {/* Top bar: badges + watchers */}
        <div className="stream-room-wn-video-top">
          <div className="stream-room-wn-video-top-left">
            {!isHost && (
              <span className={`stream-room-badge${streamStatus === "live" ? " is-live" : ""}`}>
                {streamStatus === "live" ? "Live" : "Offline"}
              </span>
            )}
            <span className="stream-room-wn-timer">{formatSeconds(timeLeft)}</span>
          </div>
          <span className="stream-room-wn-watchers">
            {(participantCount ?? data.watchersCount).toLocaleString()} watching
          </span>
        </div>

        {/* Bottom: seller + title */}
        <div className="stream-room-wn-video-footer">
          <p className="stream-room-wn-video-seller">{data.seller?.user?.displayName ?? "Verified seller"}</p>
          <p className="stream-room-wn-video-title">{data.title}</p>
        </div>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div className="stream-room-wn-sidebar">
        {/* Price summary */}
        <div className="stream-room-wn-price-bar">
          <div>
            <span className="stream-room-wn-price-label">Current bid</span>
            <span className="stream-room-wn-price-value">{formatCurrency(data.currentBid, currency)}</span>
          </div>
          <div>
            <span className="stream-room-wn-price-label">Minimum</span>
            <span className="stream-room-wn-price-value">{formatCurrency(minimumBid, currency)}</span>
          </div>
          <div>
            <span className="stream-room-wn-price-label">Closes in</span>
            <span className="stream-room-wn-price-value">{roomLive ? formatSeconds(timeLeft) : "—"}</span>
          </div>
        </div>

        {/* Chat feed */}
        <div ref={chatRef} className="stream-room-wn-chat">
          {data.chatMessages.length === 0 ? (
            <p className="stream-room-empty">No messages yet.</p>
          ) : (
            data.chatMessages.slice(-60).map((entry) => (
              <div
                key={entry.id}
                className={`stream-room-wn-msg${entry.senderId === sessionUserId ? " is-own" : ""}`}
              >
                <span className="stream-room-wn-msg-name">{entry.sender.displayName ?? "Guest"}</span>
                <span className="stream-room-wn-msg-body">{entry.body}</span>
              </div>
            ))
          )}
        </div>

        {/* Chat compose */}
        <div className="stream-room-wn-compose">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
            placeholder="Say something..."
            className="stream-room-wn-compose-input"
          />
          <button onClick={() => void handleSend()} className="stream-room-wn-send-btn" aria-label="Send">
            ↑
          </button>
        </div>

        {/* Bid area */}
        <div className="stream-room-wn-bid-area">
          {data.listingType !== "BUY_NOW" && (
            <>
              <div className="stream-room-wn-chips">
                {quickBidOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => { setBidAmount((amount / 100).toFixed(2)); void handleBid(amount); }}
                    className="stream-room-wn-chip"
                  >
                    {formatCurrency(amount, currency)}
                  </button>
                ))}
              </div>
              <div className="stream-room-wn-bid-row">
                <input
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleBid(); }}
                  inputMode="decimal"
                  placeholder={(minimumBid / 100).toFixed(2)}
                  className="stream-room-wn-bid-input"
                />
                <button
                  onClick={() => void handleBid()}
                  disabled={isListingSeller || !canUseStripe || !roomLive}
                  className="stream-room-wn-bid-btn"
                >
                  BID
                </button>
              </div>
            </>
          )}

          {data.listingType !== "AUCTION" && data.buyNowPrice ? (
            <button
              onClick={() => void handleBuyNow()}
              disabled={isListingSeller || !canUseStripe}
              className="stream-room-wn-buy-btn"
            >
              Buy now — {formatCurrency(data.buyNowPrice, currency)}
            </button>
          ) : null}

          <div className="stream-room-wn-secondary-actions">
            <button
              onClick={() => void handleMessageSeller()}
              disabled={isListingSeller}
              className="stream-room-wn-msg-seller-btn"
            >
              Message seller
            </button>
          </div>

          {!canUseStripe && (
            <p className="app-form-hint is-warning">Connect Stripe to place bids.</p>
          )}
          {actionStatus ? <p className="stream-room-wn-status">{actionStatus}</p> : null}
        </div>
      </div>
    </section>
  );
}
