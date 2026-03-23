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
import {
  compactWantActivity,
  compactWantMeta,
  wantPriceLabel,
  type WantRequestListItem,
} from "@/lib/wants";

type MarketListingCardProps = {
  listing: MarketListing;
  saved?: boolean;
  onToggleSave?: (listingId: string) => void | Promise<boolean>;
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
  saved?: boolean;
  onToggleSave?: (tradePostId: string) => void | Promise<boolean>;
};

type WantListingCardProps = {
  kind: "want";
  want: WantRequestListItem;
  saved?: boolean;
  onToggleSave?: (wantRequestId: string) => void | Promise<boolean>;
};

type ListingCardProps =
  | MarketListingCardProps
  | TradeListingCardProps
  | LiveListingCardProps
  | WantListingCardProps;

type ListingSurfaceData = {
  href: string;
  imageUrl: string;
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  metaLabel: string;
  priceLabel: string;
  activityLabel: string;
  sellerLabel: string;
  saveInactiveLabel: string;
  saveActiveLabel: string;
  hasImage: boolean;
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
  const activity = listing.listingType === "BUY_NOW"
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
    activityLabel: activity,
    sellerLabel: listing.seller?.user?.displayName ?? "Verified seller",
    saveInactiveLabel: "Add listing to watchlist",
    saveActiveLabel: "Remove listing from watchlist",
    hasImage: true,
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
    activityLabel: `${trade._count.offers} offer${trade._count.offers === 1 ? "" : "s"}`,
    sellerLabel: trade.owner.displayName ?? trade.owner.username ?? "Collector",
    saveInactiveLabel: "Save trade",
    saveActiveLabel: "Remove saved trade",
    hasImage: true,
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
  const activityLabel = stream.streamState === "live"
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
    activityLabel,
    sellerLabel: seller,
    saveInactiveLabel: stream.streamState === "upcoming" ? "Set reminder" : "Save stream",
    saveActiveLabel: stream.streamState === "upcoming" ? "Remove reminder" : "Remove saved stream",
    hasImage: true,
  };
}

function wantListingToSurfaceData(want: WantRequestListItem): ListingSurfaceData {
  const imageUrl = resolveDisplayMediaUrl(want.imageUrl, "");
  const statusClass = want.status === "OPEN"
    ? "trade-status-chip is-open"
    : want.status === "FULFILLED"
      ? "trade-status-chip is-matched"
      : want.status === "PAUSED"
        ? "trade-status-chip is-paused"
        : "trade-status-chip is-closed";

  return {
    href: `/wants/${encodeURIComponent(want.id)}`,
    imageUrl,
    title: want.title,
    badgeLabel: want.status === "OPEN" ? "Want" : want.status,
    badgeClassName: statusClass,
    metaLabel: compactWantMeta(want),
    priceLabel: wantPriceLabel(want.priceMin, want.priceMax),
    activityLabel: compactWantActivity(want.notes),
    sellerLabel: want.user.displayName ?? want.user.username ?? "Collector",
    saveInactiveLabel: "Save want",
    saveActiveLabel: "Remove saved want",
    hasImage: Boolean(imageUrl),
  };
}

export function ListingCard(props: ListingCardProps) {
  const isLiveCard = "stream" in props;
  const surfaceKind = "trade" in props
    ? "trade"
    : "want" in props
      ? "want"
      : isLiveCard
        ? "live"
        : "market";
  const controlledSaved = isLiveCard ? props.saved : undefined;
  const [localSaved, setLocalSaved] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const trade = "trade" in props ? props.trade : undefined;
  const want = "want" in props ? props.want : undefined;
  const stream = "stream" in props ? props.stream : undefined;
  const listing = !("trade" in props) && !("stream" in props) && !("want" in props) ? props.listing : undefined;
  const surface = useMemo(() => {
    if (trade) return tradeListingToSurfaceData(trade);
    if (want) return wantListingToSurfaceData(want);
    if (stream) return liveListingToSurfaceData(stream);
    return marketListingToSurfaceData(listing!);
  }, [trade, want, stream, listing]);
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageSrc = failedSrc === surface.imageUrl ? fallbackImage : surface.imageUrl;
  const saved = props.saved ?? controlledSaved ?? localSaved;

  const toggleSave = () => {
    if ("stream" in props && props.onToggleSave) {
      void props.onToggleSave(props.stream.id);
      return;
    }
    if ("trade" in props && props.onToggleSave) {
      void props.onToggleSave(props.trade.id);
      return;
    }
    if ("want" in props && props.onToggleSave) {
      void props.onToggleSave(props.want.id);
      return;
    }
    if ("listing" in props && props.onToggleSave) {
      void props.onToggleSave(props.listing.id);
      return;
    }
    setLocalSaved((prev) => !prev);
  };

  return (
    <article className={`market-v2-listing-card product-card listing-card is-${surfaceKind}-card`}>
      <Link href={surface.href} className="listing-card-link">
        <div className={`listing-card-media ${surface.hasImage ? "" : "is-fallback"}`}>
          {surface.hasImage ? (
            <Image
              src={imageSrc}
              alt={surface.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 280px"
              className="listing-card-image"
              unoptimized
              onError={() => {
                if (failedSrc !== surface.imageUrl) {
                  setFailedSrc(surface.imageUrl);
                }
              }}
            />
          ) : null}
        </div>

        <div className="listing-card-overlay">
          <div className="listing-card-top">
            <span className={`listing-card-badge ${surface.badgeClassName}`}>{surface.badgeLabel}</span>
          </div>

          <div className="listing-card-bottom">
            <div className="listing-card-copy">
              <h3 className="listing-card-title">{surface.title}</h3>
              <p className="listing-card-meta">{surface.metaLabel}</p>
              <strong className="listing-card-price">{surface.priceLabel}</strong>
              <div className="listing-card-foot">
                <span className="listing-card-activity">{surface.activityLabel}</span>
                <span className="listing-card-seller">{compactName(surface.sellerLabel)}</span>
              </div>
            </div>
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
