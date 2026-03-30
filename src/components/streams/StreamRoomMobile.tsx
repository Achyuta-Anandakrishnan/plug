"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveKitStream } from "@/components/streams/LiveKitStream";
import { StreamInventoryManager } from "@/components/streams/StreamInventoryManager";
import { useAuction } from "@/hooks/useAuction";
import type { AuctionDetail } from "@/hooks/useAuction";
import { getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";

type StreamRoomMobileProps = {
  auctionId: string;
  initialData?: AuctionDetail | null;
  stripeEnabled?: boolean;
};

function MobileAvatar({
  image,
  displayName,
  size = 32,
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
        className="srm-avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="srm-avatar-initial"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

export function StreamRoomMobile({
  auctionId,
  initialData,
  stripeEnabled = true,
}: StreamRoomMobileProps) {
  const router = useRouter();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refresh } = useAuction(auctionId, 5000, initialData);
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
  const minimumBid = nextBid;
  const parsedBidAmount = Number(bidAmount);
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
    setActionStatus(`Bid placed · ${formatCurrency(amount, currency)}`);
    setBidAmount(((amount + data.minBidIncrement) / 100).toFixed(2));
    void refresh({ poll: true, silent: true });
  };

  const handleBuyNow = async () => {
    if (!data) return;
    if (!canUseStripe) { setActionStatus("Payments are unavailable right now."); return; }
    if (!sessionUserId) { setActionStatus("Sign in to buy now."); await signIn(); return; }
    if (isListingSeller) { setActionStatus("Sellers cannot buy their own listings."); return; }
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
      <div className="srm-loading">
        <CheckersLoader title="Loading stream…" compact />
      </div>
    );
  }

  if (error || !data) {
    return <p className="app-status-note is-error">{error || "Unable to load listing."}</p>;
  }

  const imageUrl = data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null;
  const sellerName = data.seller?.user?.displayName ?? "Verified seller";
  const sellerImage = data.seller?.user?.image ?? null;

  return (
    <section className="srm-page">
      {/* ── Video fills entire container ── */}
      <div className="srm-video">
        <LiveKitStream
          auctionId={data.id}
          isHost={isHost}
          fallbackImageUrl={imageUrl}
          fallbackVideoUrl={data.videoStreamUrl}
          onParticipantCount={setParticipantCount}
          onStatusChange={setStreamStatus}
        />
        <div className="srm-grad-top" aria-hidden />
        <div className="srm-grad-bottom" aria-hidden />
      </div>

      {/* ── Top HUD ── */}
      <div className="srm-hud-top">
        <div className="srm-hud-left">
          <span className={`srm-live-badge${roomLive ? " is-live" : ""}`}>
            {roomLive ? "● Live" : "Offline"}
          </span>
          <span className="srm-timer">{formatSeconds(timeLeft)}</span>
        </div>
        <span className="srm-watchers">
          {(participantCount ?? data.watchersCount).toLocaleString()} watching
        </span>
      </div>

      {/* ── Chat feed floats above tray ── */}
      <div ref={chatRef} className="srm-chat" aria-label="Live chat">
        {data.chatMessages.slice(-50).map((entry) => (
          <div
            key={entry.id}
            className={`srm-msg${entry.senderId === sessionUserId ? " is-own" : ""}`}
          >
            <span className="srm-msg-name">{entry.sender.displayName ?? "Guest"}</span>
            <span className="srm-msg-body">{entry.body}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom tray — glass panel pinned to bottom ── */}
      <div className="srm-tray">

        {/* Seller identity + live price */}
        <div className="srm-tray-top">
          <MobileAvatar image={sellerImage} displayName={sellerName} size={32} />
          <div className="srm-tray-seller-info">
            <span className="srm-tray-seller-name">{sellerName}</span>
            <span className="srm-tray-title">{data.title}</span>
          </div>
          {!isListingSeller && (
            <button
              className={`srm-follow-btn${isFollowing ? " is-following" : ""}`}
              onClick={() => setIsFollowing((f) => !f)}
            >
              {isFollowing ? "✓" : "Follow"}
            </button>
          )}
          <div className="srm-tray-price">
            <span className="srm-tray-price-label">Bid</span>
            <span className={`srm-tray-price-val${timeLeft < 60 && roomLive ? " is-urgent" : ""}`}>
              {formatCurrency(data.currentBid, currency)}
            </span>
          </div>
        </div>

        {/* Auction bid controls */}
        {data.listingType !== "BUY_NOW" && (
          <>
            <div className="srm-chips">
              {quickBidOptions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="srm-chip"
                  onClick={() => { setBidAmount((amount / 100).toFixed(2)); void handleBid(amount); }}
                  disabled={isListingSeller || !canUseStripe || !roomLive}
                >
                  {formatCurrency(amount, currency)}
                </button>
              ))}
            </div>
            <div className="srm-bid-row">
              <span className="srm-currency">$</span>
              <input
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleBid(); }}
                inputMode="decimal"
                placeholder={(minimumBid / 100).toFixed(2)}
                className="srm-bid-input"
              />
              <button
                onClick={() => void handleBid()}
                disabled={isListingSeller || !canUseStripe || !roomLive}
                className="srm-bid-btn"
              >
                BID
              </button>
            </div>
          </>
        )}

        {/* Buy now */}
        {data.listingType !== "AUCTION" && data.buyNowPrice ? (
          <button
            onClick={() => void handleBuyNow()}
            disabled={isListingSeller || !canUseStripe}
            className="srm-buy-btn"
          >
            Buy now · {formatCurrency(data.buyNowPrice, currency)}
          </button>
        ) : null}

        {/* Compose + secondary actions */}
        <div className="srm-compose">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
            placeholder="Say something…"
            className="srm-compose-input"
          />
          <button
            onClick={() => void handleSend()}
            className="srm-send-btn"
            aria-label="Send"
          >
            ↑
          </button>
          {!isListingSeller && sessionUserId && (
            <button
              onClick={() => void handleMessageSeller()}
              className="srm-dm-btn"
              aria-label="Message seller"
            >
              DM
            </button>
          )}
        </div>

        {/* Host tools */}
        {isHost && (
          <div className="srm-host-panel">
            <StreamInventoryManager auctionId={data.id} compact />
          </div>
        )}

        {!canUseStripe && (
          <p className="srm-hint is-warning">Payments unavailable on this platform.</p>
        )}
        {actionStatus ? <p className="srm-status">{actionStatus}</p> : null}
      </div>
    </section>
  );
}
