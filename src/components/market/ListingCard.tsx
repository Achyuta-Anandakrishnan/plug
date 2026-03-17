"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MarketListing } from "@/components/market/types";
import { getGradeLabel, getPrimaryImageUrl, getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { tradeValueLabel, type TradePostListItem } from "@/lib/trade-client";

type MarketListingCardProps = {
  listing: MarketListing;
};

type TradeListingCardProps = {
  kind: "trade";
  trade: TradePostListItem;
};

type ListingCardProps = MarketListingCardProps | TradeListingCardProps;

type ListingSurfaceData = {
  href: string;
  imageUrl: string;
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  metaLabel: string;
  priceLabel: string;
  supportLabel: string;
  sellerLabel: string;
};

function compactName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 22) return trimmed;
  return `${trimmed.slice(0, 19)}...`;
}

function marketListingToSurfaceData(listing: MarketListing): ListingSurfaceData {
  const currency = listing.currency?.toUpperCase() || "USD";
  const grade = getGradeLabel(listing.item?.attributes);
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(getPrimaryImageUrl(listing), fallbackImage);
  const price = listing.listingType === "AUCTION"
    ? formatCurrency(listing.currentBid, currency)
    : formatCurrency(listing.buyNowPrice ?? listing.currentBid, currency);
  const badgeLabel = listing.listingType === "BOTH"
    ? "Auction"
    : listing.listingType.replace("_", " ");
  const meta = grade || listing.category?.name || "Verified listing";
  const timeMeta = listing.listingType === "BUY_NOW"
    ? "Buy now"
    : formatSeconds(getTimeLeftSeconds(listing));
  const support = [timeMeta, `${listing.watchersCount} watching`].filter(Boolean).join(" · ");

  return {
    href: `/auctions/${listing.id}`,
    imageUrl,
    title: listing.title,
    badgeLabel,
    badgeClassName: "market-v2-listing-badge",
    metaLabel: meta,
    priceLabel: price,
    supportLabel: support,
    sellerLabel: listing.seller?.user?.displayName ?? "Verified seller",
  };
}

function tradeListingToSurfaceData(trade: TradePostListItem): ListingSurfaceData {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(trade.images[0]?.url ?? null, fallbackImage);
  const grade = [trade.gradeCompany, trade.gradeLabel].filter(Boolean).join(" ").trim();
  const meta = grade || trade.category || "Trade board";
  const statusClass = trade.status === "OPEN"
    ? "trade-status-chip is-open"
    : trade.status === "MATCHED"
      ? "trade-status-chip is-matched"
      : trade.status === "PAUSED"
        ? "trade-status-chip is-paused"
        : "trade-status-chip is-closed";

  return {
    href: `/trades/${encodeURIComponent(trade.id)}`,
    imageUrl,
    title: trade.title,
    badgeLabel: trade.status,
    badgeClassName: statusClass,
    metaLabel: meta,
    priceLabel: tradeValueLabel(trade.valueMin, trade.valueMax),
    supportLabel: `${trade._count.offers} offer${trade._count.offers === 1 ? "" : "s"}`,
    sellerLabel: trade.owner.displayName ?? trade.owner.username ?? "Collector",
  };
}

export function ListingCard(props: ListingCardProps) {
  const [watching, setWatching] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const surface = useMemo(() => {
    if ("trade" in props) {
      return tradeListingToSurfaceData(props.trade);
    }
    return marketListingToSurfaceData(props.listing);
  }, [props]);
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageSrc = failedSrc === surface.imageUrl ? fallbackImage : surface.imageUrl;

  return (
    <article className="market-v2-listing-card product-card listing-card">
      <Link href={surface.href} className="listing-card-link">
        <div className="listing-card-media">
          <Image
            src={imageSrc}
            alt={surface.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 280px"
            className="object-cover"
            unoptimized
            onError={() => {
              if (failedSrc !== surface.imageUrl) {
                setFailedSrc(surface.imageUrl);
              }
            }}
          />
        </div>

        <div className="listing-card-overlay">
          <div className="listing-card-top">
            <span className={surface.badgeClassName}>{surface.badgeLabel}</span>
          </div>

          <div className="listing-card-bottom">
            <div className="listing-card-copy">
              <h3 className="listing-card-title">{surface.title}</h3>
              <p className="listing-card-meta">{surface.metaLabel}</p>
              <div className="listing-card-value">
                <strong>{surface.priceLabel}</strong>
                <span>{surface.supportLabel}</span>
              </div>
            </div>
            <span className="listing-card-seller">{compactName(surface.sellerLabel)}</span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setWatching((prev) => !prev)}
        className={`listing-card-watch ${watching ? "is-active" : ""}`}
        aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
      >
        {watching ? "♥" : "♡"}
      </button>
    </article>
  );
}
