"use client";

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
  const { data, loading, error, refresh } = useAuction(auctionId, 5000, initialData);
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";

  const [message, setMessage] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");

  const timeLeft = useMemo(() => (data ? getTimeLeftSeconds(data) : 0), [data]);

  const nextBid = data ? data.currentBid + data.minBidIncrement : 0;
  const currency = data?.currency?.toUpperCase() ?? "USD";
  const effectiveBuyerId = sessionUserId;
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

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-white/60 bg-slate-900">
        <div className="relative h-60">
          <LiveKitStream
            auctionId={data.id}
            isHost={Boolean(sessionUserId && data.seller?.user?.id === sessionUserId)}
            fallbackImageUrl={data.item?.images?.find((img) => img.isPrimary)?.url ?? data.item?.images?.[0]?.url ?? null}
            fallbackVideoUrl={data.videoStreamUrl}
            onParticipantCount={setParticipantCount}
            onStatusChange={setStreamStatus}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${streamStatus === "live" ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white"}`}>
              {streamStatus === "live" ? "Live" : "Offline"}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">{formatSeconds(timeLeft)}</span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-slate-950/55 px-3 py-2 text-white">
            <p className="font-display text-lg">{data.title}</p>
            <p className="text-xs text-white/70">{(participantCount ?? data.watchersCount)} watching</p>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-3xl p-4 space-y-3">
        <p className="font-display text-xl text-slate-900">{formatCurrency(data.currentBid, currency)}</p>
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
        {actionStatus && <p className="text-xs text-slate-600">{actionStatus}</p>}
      </section>

      <section className="surface-panel rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-slate-900">Chat</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Scroll</span>
        </div>
        <div className="max-h-52 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600">
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

      <section className="surface-panel rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-slate-900">Recent bids</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Scroll</span>
        </div>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600">
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
