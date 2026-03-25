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
import { ListingImageStrip } from "@/components/streams/ListingImageStrip";

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
  const streamFrameRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refresh } = useAuction(auctionId, 4000, initialData);
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";

  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const timeLeft = useMemo(() => (data ? getTimeLeftSeconds(data) : 0), [data]);

  const nextBid = data ? data.currentBid + data.minBidIncrement : 0;
  const currency = data?.currency?.toUpperCase() ?? "USD";
  const effectiveBuyerId = sessionUserId;
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

    const confirmBuy = window.confirm(
      `Confirm buy now for ${formatCurrency(data.buyNowPrice ?? 0, currency)}?`,
    );
    if (!confirmBuy) return;

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

  const handleFullscreenToggle = async () => {
    if (!streamFrameRef.current) return;
    if (!document.fullscreenElement) {
      await streamFrameRef.current.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
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
    <section className="stream-room-shell">
      <div
        ref={streamFrameRef}
        className="stream-room-video"
      >
        <LiveKitStream
          auctionId={data.id}
          isHost={isHost}
          fallbackImageUrl={imageUrl}
          fallbackVideoUrl={data.videoStreamUrl}
          onParticipantCount={setParticipantCount}
          onStatusChange={setStreamStatus}
        />

        <div className="stream-room-video-overlay-gradient" aria-hidden="true" />

        <div className="stream-room-video-top">
          <div className="stream-room-video-top-left">
            {!isHost && (
              <span className={`stream-room-badge${streamStatus === "live" ? " is-live" : ""}`}>
                {streamStatus === "live" ? "Live" : "Offline"}
              </span>
            )}
            <span className="stream-room-badge">{formatSeconds(timeLeft)} left</span>
          </div>
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="stream-room-video-fullscreen-btn"
          >
            {isFullscreen ? "Exit full" : "Full screen"}
          </button>
        </div>

        <div className="stream-room-video-bottom">
          <div>
            <p className="stream-room-video-title">{data.title}</p>
            <p className="stream-room-video-meta">
              {data.seller?.user?.displayName ?? "Verified seller"} · {(participantCount ?? data.watchersCount)} watching
            </p>
          </div>
          <div className="stream-room-video-price">
            <p className="stream-room-video-price-label">Current</p>
            <p className="stream-room-video-price-value">{formatCurrency(data.currentBid, currency)}</p>
          </div>
        </div>

        {isFullscreen && (
          <div className="stream-room-fullscreen-panels">
            <div className="stream-room-fullscreen-panel">
              <p className="stream-room-panel-eyebrow">Quick bids</p>
              <div className="stream-room-panel-list">
                {data.bids.slice(0, 10).map((bid) => (
                  <div key={bid.id} className="stream-room-panel-row">
                    <span>{bid.bidderId.slice(0, 6)}...</span>
                    <span>{formatCurrency(bid.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stream-room-fullscreen-panel">
              <p className="stream-room-panel-eyebrow">Chat</p>
              <div className="stream-room-panel-list">
                {data.chatMessages.slice(-20).map((entry) => (
                  <div key={entry.id} className="stream-room-panel-bubble">
                    <span className="stream-room-panel-sender">{entry.sender.displayName ?? "Guest"}</span>
                    {entry.body}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="stream-room-rail">
        <section className="stream-room-rail-panel stream-room-bid-summary-panel">
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
          )}

          <div className="stream-room-action-stack">
            {data.listingType !== "BUY_NOW" && (
              <button
                onClick={() => void handleBid()}
                disabled={isListingSeller || !canUseStripe || !roomLive}
                className="app-button app-button-primary"
              >
                Place bid {formatCurrency(validBidAmount, currency)}
              </button>
            )}
            {data.listingType !== "AUCTION" && data.buyNowPrice && (
              <button
                onClick={handleBuyNow}
                disabled={isListingSeller || !canUseStripe}
                className="app-button app-button-secondary"
              >
                Buy now {formatCurrency(data.buyNowPrice, currency)}
              </button>
            )}
            <button
              onClick={handleMessageSeller}
              disabled={isListingSeller}
              className="app-button app-button-secondary"
            >
              Message seller
            </button>
          </div>

          {!canUseStripe && (
            <p className="app-form-hint is-warning">Stripe checkout is disabled. Connect Stripe to place offers.</p>
          )}
          {actionStatus && <p className="app-form-hint">{actionStatus}</p>}
        </section>

        <ListingImageStrip images={data.item?.images ?? []} />

        <section className="stream-room-rail-panel stream-room-chat-panel">
          <div className="stream-room-rail-head">
            <h3 className="stream-room-panel-title">Chat</h3>
            <span className="app-eyebrow">Live room</span>
          </div>

          <div className="stream-room-chat-feed">
            {data.chatMessages.length === 0 && (
              <p className="stream-room-empty">No chat yet. Be first to comment.</p>
            )}
            {data.chatMessages.map((entry) => (
              <div
                key={entry.id}
                className={`stream-room-chat-bubble${entry.senderId === sessionUserId ? " is-own" : ""}`}
              >
                <span className="stream-room-chat-sender">{entry.sender.displayName ?? "Guest"}</span>
                <span>{entry.body}</span>
              </div>
            ))}
          </div>

          <div className="stream-room-chat-compose">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message the room"
              className="app-form-input"
            />
            <button onClick={handleSend} className="app-button app-button-primary">
              Send
            </button>
          </div>
        </section>

        <section className="stream-room-rail-panel stream-room-bids-panel">
          <div className="stream-room-rail-head">
            <h3 className="stream-room-panel-title">Recent bids</h3>
            <span className="app-eyebrow">Activity</span>
          </div>
          <div className="stream-room-bids-feed">
            {data.bids.length === 0 && (
              <p className="stream-room-empty">No bids yet.</p>
            )}
            {data.bids.map((bid) => (
              <div key={bid.id} className="stream-room-bid-row">
                <span className="stream-room-bid-bidder">{bid.bidderId.slice(0, 6)}...</span>
                <span className="stream-room-bid-amount">{formatCurrency(bid.amount, currency)}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
