"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const streamFrameRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refresh } = useAuction(auctionId, 4000, initialData);
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";

  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);

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

    const confirmBid = window.confirm(`Place bid for ${formatCurrency(nextBid, currency)}?`);
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

  const imageUrl = data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null;

  return (
    <section className="grid h-[calc(100vh-260px)] min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div
        ref={streamFrameRef}
        className="relative overflow-hidden rounded-[28px] border border-white/60 bg-slate-900"
      >
        <LiveKitStream
          auctionId={data.id}
          isHost={isHost}
          fallbackImageUrl={imageUrl}
          fallbackVideoUrl={data.videoStreamUrl}
          onParticipantCount={setParticipantCount}
          onStatusChange={setStreamStatus}
        />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,_rgba(2,6,23,0.75),_rgba(2,6,23,0.15)_45%,_transparent)]" />

        <div className="absolute left-4 top-4 right-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${streamStatus === "live" ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white"}`}>
              {streamStatus === "live" ? "Live" : "Offline"}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">
              {formatSeconds(timeLeft)} left
            </span>
          </div>
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="rounded-full border border-white/30 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-white"
          >
            {isFullscreen ? "Exit full" : "Full screen"}
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 text-white">
          <div>
            <p className="font-display text-2xl">{data.title}</p>
            <p className="text-xs text-white/70">
              {data.seller?.user?.displayName ?? "Verified seller"} · {(participantCount ?? data.watchersCount)} watching
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 px-4 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Current</p>
            <p className="font-display text-xl">{formatCurrency(data.currentBid, currency)}</p>
          </div>
        </div>

        {isFullscreen && (
          <div className="absolute bottom-4 right-4 top-16 w-[340px] space-y-3">
            <div className="rounded-2xl border border-white/20 bg-slate-950/65 p-3 backdrop-blur">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/70">Quick bids</p>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1 text-xs text-white/90">
                {data.bids.slice(0, 10).map((bid) => (
                  <div key={bid.id} className="flex items-center justify-between rounded-xl bg-white/10 px-2 py-1.5">
                    <span>{bid.bidderId.slice(0, 6)}...</span>
                    <span className="font-semibold">{formatCurrency(bid.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-slate-950/65 p-3 backdrop-blur">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/70">Chat</p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs text-white/90">
                {data.chatMessages.slice(-20).map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white/10 px-2 py-1.5">
                    <span className="block text-[10px] text-white/60">{entry.sender.displayName ?? "Guest"}</span>
                    {entry.body}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <section className="surface-panel rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Next bid</span>
            <span className="font-display text-xl text-slate-900">{formatCurrency(nextBid, currency)}</span>
          </div>

          <div className="grid gap-2">
            {data.listingType !== "BUY_NOW" && (
              <button
                onClick={handleBid}
                disabled={isListingSeller || !canUseStripe}
                className="rounded-full bg-[var(--royal)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Place bid
              </button>
            )}
            {data.listingType !== "AUCTION" && data.buyNowPrice && (
              <button
                onClick={handleBuyNow}
                disabled={isListingSeller || !canUseStripe}
                className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
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
            <p className="text-xs text-amber-700">Stripe checkout is disabled. Connect Stripe to place offers.</p>
          )}
          {actionStatus && <p className="text-xs text-slate-600">{actionStatus}</p>}
        </section>

        <section className="surface-panel rounded-3xl p-4 min-h-0 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Chat</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Scrollable</span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600">
            {data.chatMessages.length === 0 && (
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">No chat yet. Be first to comment.</div>
            )}
            {data.chatMessages.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl px-3 py-2 ${entry.senderId === sessionUserId ? "ml-auto bg-[var(--royal)]/10 text-slate-800" : "bg-slate-100 text-slate-600"}`}
              >
                <span className="block text-xs font-semibold text-slate-500">{entry.sender.displayName ?? "Guest"}</span>
                <span>{entry.body}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 pt-2">
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

        <section className="surface-panel rounded-3xl p-4 min-h-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-slate-900">Recent bids</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Scrollable</span>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1 text-sm text-slate-600 max-h-[210px]">
            {data.bids.length === 0 && (
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">No bids yet.</div>
            )}
            {data.bids.map((bid) => (
              <div key={bid.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{bid.bidderId.slice(0, 6)}...</span>
                <span className="font-semibold text-slate-900">{formatCurrency(bid.amount, currency)}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
