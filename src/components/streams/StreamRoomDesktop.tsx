"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveKitStream } from "@/components/streams/LiveKitStream";
import { StreamInventoryManager } from "@/components/streams/StreamInventoryManager";

type StreamRoomDesktopProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

function SellerAvatar({
  image,
  displayName,
  size = 40,
}: {
  image: string | null;
  displayName: string | null;
  size?: number;
}) {
  const initial = (displayName ?? "?")[0]?.toUpperCase() ?? "?";
  if (image) {
    return (
      <Image
        src={image}
        alt={displayName ?? "Seller"}
        width={size}
        height={size}
        className="stream-room-seller-avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="stream-room-seller-avatar stream-room-seller-avatar-initial"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

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
  const [isFollowing, setIsFollowing] = useState(false);

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
    if (!canUseStripe) { setActionStatus("Payments are unavailable right now."); return; }
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
    if (!canUseStripe) { setActionStatus("Payments are unavailable right now."); return; }
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
    const trimmed = message.trim();
    setMessage("");
    const response = await fetch(`/api/auctions/${data.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(trimmed);
      setActionStatus(payload.error || "Unable to send message.");
      return;
    }
    void refresh({ poll: true, silent: true });
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
  const sellerName = data.seller?.user?.displayName ?? "Verified seller";
  const sellerImage = data.seller?.user?.image ?? null;
  const recentBids = data.bids.slice(-12).reverse();

  return (
    <section className="stream-room-v4-shell">
      {/* ── LEFT: Bids panel ─────────────────────────────────── */}
      <aside className="stream-room-v4-left">
        {/* ── TOP: always visible ── */}
        <div className="stream-room-v4-left-top">
          {/* Seller identity + follow */}
          <div className="stream-room-v4-seller">
            <SellerAvatar image={sellerImage} displayName={sellerName} size={38} />
            <div className="stream-room-v4-seller-info">
              <span className="stream-room-v4-seller-name">{sellerName}</span>
              <span className="stream-room-v4-seller-tag">{data.category?.name ?? "Collectibles"}</span>
            </div>
            {!isListingSeller && (
              <button
                className={`stream-room-v4-follow-btn${isFollowing ? " is-following" : ""}`}
                onClick={() => setIsFollowing((f) => !f)}
              >
                {isFollowing ? "✓" : "Follow"}
              </button>
            )}
          </div>

          {/* Live price summary */}
          <div className="stream-room-v4-prices">
            <div className="stream-room-v4-price-cell">
              <span className="stream-room-v4-price-label">Current bid</span>
              <span className="stream-room-v4-price-val">{formatCurrency(data.currentBid, currency)}</span>
            </div>
            <div className="stream-room-v4-price-cell">
              <span className="stream-room-v4-price-label">Next bid</span>
              <span className="stream-room-v4-price-val">{formatCurrency(minimumBid, currency)}</span>
            </div>
            <div className="stream-room-v4-price-cell">
              <span className="stream-room-v4-price-label">Closes in</span>
              <span className={`stream-room-v4-price-val${timeLeft < 60 && roomLive ? " is-urgent" : ""}`}>
                {roomLive ? formatSeconds(timeLeft) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: scrollable ── */}
        <div className="stream-room-v4-left-scroll">
          {/* Current item card */}
          {imageUrl && (
            <div className="stream-room-v4-item-card">
              <div className="stream-room-v4-item-img-wrap">
                <Image
                  src={imageUrl}
                  alt={data.title}
                  fill
                  sizes="240px"
                  className="stream-room-v4-item-img"
                />
              </div>
              <div className="stream-room-v4-item-meta">
                <p className="stream-room-v4-item-title">{data.title}</p>
                {data.item?.condition && (
                  <p className="stream-room-v4-item-cond">{data.item.condition}</p>
                )}
              </div>
            </div>
          )}

          {/* Bid history */}
          <div className="stream-room-v4-bid-history">
            <p className="stream-room-v4-section-label">Recent bids</p>
            {recentBids.length === 0 ? (
              <p className="stream-room-v4-empty-note">No bids yet — be first!</p>
            ) : (
              <div className="stream-room-v4-bid-list">
                {recentBids.map((bid, i) => (
                  <div key={bid.id} className={`stream-room-v4-bid-row${i === 0 ? " is-top" : ""}`}>
                    <span className="stream-room-v4-bid-who">
                      {bid.bidderId === sessionUserId ? "You" : `Bidder #${recentBids.length - i}`}
                    </span>
                    <span className="stream-room-v4-bid-amt">{formatCurrency(bid.amount, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message seller + Host inventory */}
          {!isListingSeller && sessionUserId && (
            <button onClick={() => void handleMessageSeller()} className="stream-room-v4-msg-seller">
              Message seller
            </button>
          )}
          {isHost && <StreamInventoryManager auctionId={data.id} compact />}
        </div>

        {/* ── BOTTOM: bid controls — always visible ── */}
        <div className="stream-room-v4-bid-controls">
          {data.listingType !== "BUY_NOW" && (
            <>
              <div className="stream-room-v4-quick-bids">
                {quickBidOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => { setBidAmount((amount / 100).toFixed(2)); void handleBid(amount); }}
                    className="stream-room-v4-quick-chip"
                    disabled={isListingSeller || !canUseStripe || !roomLive}
                  >
                    {formatCurrency(amount, currency)}
                  </button>
                ))}
              </div>
              <div className="stream-room-v4-bid-row-input">
                <span className="stream-room-v4-currency-prefix">$</span>
                <input
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleBid(); }}
                  inputMode="decimal"
                  placeholder={(minimumBid / 100).toFixed(2)}
                  className="stream-room-v4-bid-input"
                />
                <button
                  onClick={() => void handleBid()}
                  disabled={isListingSeller || !canUseStripe || !roomLive}
                  className="stream-room-v4-bid-btn"
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
              className="stream-room-v4-buy-btn"
            >
              Buy now · {formatCurrency(data.buyNowPrice, currency)}
            </button>
          ) : null}
          {!canUseStripe && (
            <p className="stream-room-v4-hint is-warning">Payments unavailable.</p>
          )}
          {actionStatus ? <p className="stream-room-v4-status">{actionStatus}</p> : null}
        </div>
      </aside>

      {/* ── CENTER: Video ─────────────────────────────────────── */}
      <div className="stream-room-v4-video">
        <LiveKitStream
          auctionId={data.id}
          isHost={isHost}
          fallbackImageUrl={imageUrl}
          fallbackVideoUrl={data.videoStreamUrl}
          onParticipantCount={setParticipantCount}
          onStatusChange={setStreamStatus}
        />

        {/* Gradient overlays */}
        <div className="stream-room-v4-grad-top" aria-hidden />
        <div className="stream-room-v4-grad-bottom" aria-hidden />

        {/* Top HUD */}
        <div className="stream-room-v4-hud-top">
          <div className="stream-room-v4-hud-left">
            <span className={`stream-room-v4-live-badge${roomLive ? " is-live" : ""}`}>
              {roomLive ? "● Live" : "Offline"}
            </span>
            <span className="stream-room-v4-timer">{formatSeconds(timeLeft)}</span>
          </div>
          <span className="stream-room-v4-watchers">
            {(participantCount ?? data.watchersCount).toLocaleString()} watching
          </span>
        </div>

        {/* Bottom HUD: seller on video */}
        <div className="stream-room-v4-hud-bottom">
          <SellerAvatar image={sellerImage} displayName={sellerName} size={32} />
          <div>
            <p className="stream-room-v4-hud-seller">{sellerName}</p>
            <p className="stream-room-v4-hud-title">{data.title}</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Chat panel ─────────────────────────────────── */}
      <aside className="stream-room-v4-right">
        <p className="stream-room-v4-section-label stream-room-v4-chat-label">Chat</p>
        <div ref={chatRef} className="stream-room-v4-chat">
          {data.chatMessages.length === 0 ? (
            <p className="stream-room-v4-empty-note">Start the conversation!</p>
          ) : (
            data.chatMessages.slice(-80).map((entry) => (
              <div
                key={entry.id}
                className={`stream-room-v4-msg${entry.senderId === sessionUserId ? " is-own" : ""}`}
              >
                <span className="stream-room-v4-msg-name">{entry.sender.displayName ?? "Guest"}</span>
                <span className="stream-room-v4-msg-body">{entry.body}</span>
              </div>
            ))
          )}
        </div>
        <div className="stream-room-v4-compose">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
            placeholder="Say something…"
            className="stream-room-v4-compose-input"
          />
          <button
            onClick={() => void handleSend()}
            className="stream-room-v4-send-btn"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </aside>
    </section>
  );
}
