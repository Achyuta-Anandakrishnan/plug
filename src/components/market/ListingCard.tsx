"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { LiveStreamItem } from "@/components/live/types";
import { streamPriceLabel, streamTimeLabel } from "@/components/live/utils";
import type { MarketListing } from "@/components/market/types";
import { getPrimaryImageUrl, getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { tradeValueLabel, type TradePostListItem } from "@/lib/trade-client";

type MarketListingCardProps = {
  listing: MarketListing;
};

type LiveListingCardProps = {
  kind: "live";
  stream: LiveStreamItem;
  saved?: boolean;
  onToggleSave?: (streamId: string) => void;
  saveActiveLabel?: string;
  saveInactiveLabel?: string;
};

type TradeListingCardProps = {
  kind: "trade";
  trade: TradePostListItem;
};

type ListingCardProps = MarketListingCardProps | TradeListingCardProps | LiveListingCardProps;

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
  saveInactiveLabel: string;
  saveActiveLabel: string;
};

function compactName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 22) return trimmed;
  return `${trimmed.slice(0, 19)}...`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function shortenCert(value: string) {
  const cert = value.trim();
  if (!cert) return "";
  if (cert.length <= 8) return cert;
  if (cert.length <= 12) return `${cert.slice(0, 4)}…${cert.slice(-4)}`;
  return cert.slice(-8);
}

function compactSummary(parts: Array<string | null | undefined>) {
  return parts
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");
}

function compactMarketMetadata(listing: MarketListing) {
  const attributes = listing.item?.attributes;
  const company = cleanText(attributes?.gradingCompany);
  const grade = cleanText(attributes?.grade);
  const label = cleanText(attributes?.gradingLabel);
  const cert = cleanText(attributes?.certNumber);
  const setName = cleanText(attributes?.set) || cleanText(attributes?.brand);
  const player = cleanText(attributes?.player) || cleanText(attributes?.subject);
  const gradeSummary = compactSummary([[company, label || grade].filter(Boolean).join(" ").trim()]);
  const certSummary = cert ? `Cert ${shortenCert(cert)}` : "";
  const cardSummary = compactSummary([[setName, player].filter(Boolean).join(" • ").trim()]);

  return compactSummary([gradeSummary, certSummary, cardSummary])
    || listing.category?.name
    || "Verified listing";
}

function compactTradeMetadata(trade: TradePostListItem) {
  const gradeSummary = [trade.gradeCompany, trade.gradeLabel].filter(Boolean).join(" ").trim();
  const cardSummary = [trade.cardSet, trade.cardNumber ? `#${trade.cardNumber}` : null].filter(Boolean).join(" ").trim();
  return compactSummary([gradeSummary, cardSummary, trade.category])
    || trade.category
    || "Trade board";
}

function marketListingToSurfaceData(listing: MarketListing): ListingSurfaceData {
  const currency = listing.currency?.toUpperCase() || "USD";
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(getPrimaryImageUrl(listing), fallbackImage);
  const price = listing.listingType === "AUCTION"
    ? formatCurrency(listing.currentBid, currency)
    : formatCurrency(listing.buyNowPrice ?? listing.currentBid, currency);
  const badgeLabel = listing.listingType === "BOTH"
    ? "Auction"
    : listing.listingType.replace("_", " ");
  const meta = compactMarketMetadata(listing);
  const timeMeta = listing.listingType === "BUY_NOW"
    ? "Buy now"
    : formatSeconds(getTimeLeftSeconds(listing));
  const support = listing.listingType === "BUY_NOW"
    ? `${listing.watchersCount} watching`
    : `${timeMeta} · ${listing.watchersCount} watching`;

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
    saveInactiveLabel: "Add listing to watchlist",
    saveActiveLabel: "Remove listing from watchlist",
  };
}

function tradeListingToSurfaceData(trade: TradePostListItem): ListingSurfaceData {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(trade.images[0]?.url ?? null, fallbackImage);
  const meta = compactTradeMetadata(trade);
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
    saveInactiveLabel: "Save trade",
    saveActiveLabel: "Remove saved trade",
  };
}

function liveListingToSurfaceData(stream: LiveStreamItem): ListingSurfaceData {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(getPrimaryImageUrl(stream), fallbackImage);
  const badgeLabel = stream.streamState === "live" ? "Live" : "Upcoming";
  const badgeClassName = stream.streamState === "live"
    ? "trade-status-chip is-open"
    : "market-v2-listing-badge";
  const seller = stream.seller?.user?.displayName ?? "Verified seller";
  const supportLabel = stream.streamState === "live"
    ? `${stream.watchersCount} watching`
    : streamTimeLabel(stream);

  return {
    href: `/streams/${stream.id}`,
    imageUrl,
    title: stream.title,
    badgeLabel,
    badgeClassName,
    metaLabel: compactMarketMetadata(stream),
    priceLabel: streamPriceLabel(stream),
    supportLabel,
    sellerLabel: seller,
    saveInactiveLabel: stream.streamState === "upcoming" ? "Set reminder" : "Save stream",
    saveActiveLabel: stream.streamState === "upcoming" ? "Remove reminder" : "Remove saved stream",
  };
}

export function ListingCard(props: ListingCardProps) {
  const isLiveCard = "stream" in props;
  const controlledSaved = isLiveCard ? props.saved : undefined;
  const [localSaved, setLocalSaved] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const surface = useMemo(() => {
    if ("trade" in props) {
      return tradeListingToSurfaceData(props.trade);
    }
    if ("stream" in props) {
      return liveListingToSurfaceData(props.stream);
    }
    return marketListingToSurfaceData(props.listing);
  }, [props]);
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageSrc = failedSrc === surface.imageUrl ? fallbackImage : surface.imageUrl;
  const saved = controlledSaved ?? localSaved;

  const toggleSave = () => {
    if ("stream" in props && props.onToggleSave) {
      props.onToggleSave(props.stream.id);
      return;
    }
    setLocalSaved((prev) => !prev);
  };

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
            <span className={`listing-card-badge ${surface.badgeClassName}`}>{surface.badgeLabel}</span>
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
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleSave();
        }}
        className={`listing-card-watch ${saved ? "is-active" : ""}`}
        aria-label={saved ? surface.saveActiveLabel : surface.saveInactiveLabel}
      >
        {saved ? "♥" : "♡"}
      </button>
    </article>
  );
}
