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
    <article className={`listing-card is-live-card${stream.streamStatus === "live" ? " is-live" : ""}`}>
      <Link href={`/streams/${stream.id}`} className="listing-card-link">
        <Image
          src={imageSrc}
          alt="Live stream cover"
          fill
          sizes="(max-width: 768px) 72vw, (max-width: 1280px) 28vw, 320px"
          className="listing-card-img"
          unoptimized
          onError={() => {
            if (imageSrc !== fallbackImage) {
              setImageSrc(fallbackImage);
            }
          }}
        />
        <div className="listing-card-gradient-top" aria-hidden="true" />
        <div className="listing-card-gradient" aria-hidden="true" />

        <div className="listing-card-top">
          <span className={`listing-card-badge${stream.streamStatus === "live" ? " is-live-badge" : ""}`}>
            {stream.streamStatus === "live" ? "Live" : "Scheduled"}
          </span>
        </div>

        <div className="listing-card-body">
          <div className="listing-card-copy">
            <h3 className="listing-card-title">{stream.title}</h3>
            <p className="listing-card-seller">{seller}</p>
          </div>
          <div className="listing-card-stats">
            <div className="listing-card-stat">
              <p className="listing-card-stat-label">Price</p>
              <p className="listing-card-stat-value">{streamPrice(stream)}</p>
            </div>
            <div className="listing-card-stat is-right">
              <p className="listing-card-stat-label">Activity</p>
              <p className="listing-card-stat-value">{streamMeta(stream)}</p>
            </div>
          </div>
        </div>
      </Link>

      {canEnd ? (
        <button
          type="button"
          onClick={() => onEnd(stream.id)}
          disabled={ending}
          className="listing-card-watch"
          aria-label="End stream"
        >
          ✕
        </button>
      ) : null}
    </article>
  );
}
