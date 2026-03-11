"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MarketStream } from "@/components/market/types";
import { formatCurrency } from "@/lib/format";
import { getPrimaryImageUrl } from "@/lib/auctions";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type LiveStreamCardProps = {
  stream: MarketStream;
  canEnd: boolean;
  ending: boolean;
  onEnd: (auctionId: string) => void;
};

function streamPrice(stream: MarketStream) {
  const currency = stream.currency?.toUpperCase() || "USD";
  if (stream.buyNowPrice && stream.buyNowPrice > 0) {
    return `Buy ${formatCurrency(stream.buyNowPrice, currency)}`;
  }
  return `Bid ${formatCurrency(stream.currentBid, currency)}`;
}

function streamMeta(stream: MarketStream) {
  if (stream.streamStatus === "live") {
    return `${stream.watchersCount} watching`;
  }
  if (!stream.startTime) {
    return "Scheduled";
  }
  const date = new Date(stream.startTime);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveStreamCard({ stream, canEnd, ending, onEnd }: LiveStreamCardProps) {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const image = useMemo(
    () => resolveDisplayMediaUrl(getPrimaryImageUrl(stream), fallbackImage),
    [stream, fallbackImage],
  );
  const [imageSrc, setImageSrc] = useState(image);
  const seller = stream.seller?.user?.displayName ?? "Host";
  const category = stream.category?.name ?? "Collectibles";

  useEffect(() => {
    setImageSrc(image);
  }, [image]);

  return (
    <article className="market-v2-stream-card">
      <Link href={`/streams/${stream.id}`} className="market-v2-stream-link">
        <div className="market-v2-stream-media">
          <Image
            src={imageSrc}
            alt="Live stream cover"
            fill
            sizes="(max-width: 768px) 72vw, (max-width: 1280px) 28vw, 320px"
            className="object-cover"
            unoptimized
            onError={() => {
              if (imageSrc !== fallbackImage) {
                setImageSrc(fallbackImage);
              }
            }}
          />
          <div className="market-v2-stream-overlay" />
          <div className="market-v2-stream-badges">
            <span className={`market-v2-live-badge ${stream.streamStatus === "live" ? "is-live" : "is-scheduled"}`}>
              {stream.streamStatus === "live" ? "Live" : "Scheduled"}
            </span>
            <span className="market-v2-live-pill">{streamPrice(stream)}</span>
          </div>
        </div>

        <div className="market-v2-stream-body">
          <h3 className="market-v2-stream-title">{stream.title}</h3>
          <p className="market-v2-stream-meta-primary">
            <span>{seller}</span>
            <span>{category}</span>
          </p>
          <p className="market-v2-stream-meta-secondary">{streamMeta(stream)}</p>
        </div>
      </Link>

      {canEnd ? (
        <button
          type="button"
          onClick={() => onEnd(stream.id)}
          disabled={ending}
          className="market-v2-stream-end"
        >
          {ending ? "Ending..." : "End"}
        </button>
      ) : null}
    </article>
  );
}
