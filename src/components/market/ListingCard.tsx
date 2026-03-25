"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { LiveStreamItem } from "@/components/live/types";
import { streamPriceLabel, streamTimeLabel } from "@/components/live/utils";
import type { MarketListing } from "@/components/market/types";
import { getPrimaryImageUrl } from "@/lib/auctions";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import { tradeValueLabel, type TradePostListItem } from "@/lib/trade-client";
import {
  bountyAmountLabel,
  bountyBudgetLabel,
  type BountyRequestListItem,
} from "@/lib/bounties";

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

type BountyListingCardProps = {
  kind: "bounty";
  bounty: BountyRequestListItem;
  saved?: boolean;
  onToggleSave?: (bountyRequestId: string) => void | Promise<boolean>;
};

type ListingCardProps =
  | MarketListingCardProps
  | TradeListingCardProps
  | LiveListingCardProps
  | BountyListingCardProps;

type ListingSurfaceData = {
  href: string;
  imageUrl: string;
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  priceLabel: string;
  activityLabel: string;
  sellerLabel: string;
  saveInactiveLabel: string;
  saveActiveLabel: string;
  hasImage: boolean;
  statsLabelLeft?: string | null;
  statsLabelRight?: string | null;
};

function compactName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 22) return trimmed;
  return `${trimmed.slice(0, 19)}...`;
}

function compactCurrency(amountCents: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function marketListingToSurfaceData(listing: MarketListing): ListingSurfaceData {
  const currency = listing.currency?.toUpperCase() || "USD";
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(getPrimaryImageUrl(listing), fallbackImage);
  const price = listing.listingType === "AUCTION"
    ? compactCurrency(listing.currentBid, currency)
    : compactCurrency(listing.buyNowPrice ?? listing.currentBid, currency);
  const badgeLabel = listing.listingType === "BOTH"
    ? "Auction"
    : listing.listingType.replace("_", " ");
  const activity = `${listing.watchersCount} like${listing.watchersCount === 1 ? "" : "s"}`;
  return {
    href: `/auctions/${listing.id}`,
    imageUrl,
    title: listing.title,
    badgeLabel,
    badgeClassName: "market-v2-listing-badge",
    priceLabel: price,
    activityLabel: activity,
    sellerLabel: listing.seller?.user?.displayName ?? "Verified seller",
    saveInactiveLabel: "Add listing to watchlist",
    saveActiveLabel: "Remove listing from watchlist",
    hasImage: true,
    statsLabelLeft: "Price",
    statsLabelRight: "Likes",
  };
}

function tradeListingToSurfaceData(trade: TradePostListItem): ListingSurfaceData {
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const imageUrl = resolveDisplayMediaUrl(trade.images[0]?.url ?? null, fallbackImage);
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
    priceLabel: tradeValueLabel(trade.valueMin, trade.valueMax),
    activityLabel: `${trade._count.offers} offer${trade._count.offers === 1 ? "" : "s"}`,
    sellerLabel: trade.owner.displayName ?? trade.owner.username ?? "Collector",
    saveInactiveLabel: "Save trade",
    saveActiveLabel: "Remove saved trade",
    hasImage: true,
    statsLabelLeft: null,
    statsLabelRight: null,
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
    priceLabel: streamPriceLabel(stream),
    activityLabel,
    sellerLabel: seller,
    saveInactiveLabel: stream.streamState === "upcoming" ? "Set reminder" : "Save stream",
    saveActiveLabel: stream.streamState === "upcoming" ? "Remove reminder" : "Remove saved stream",
    hasImage: true,
    statsLabelLeft: null,
    statsLabelRight: null,
  };
}

function bountyListingToSurfaceData(bounty: BountyRequestListItem): ListingSurfaceData {
  const imageUrl = resolveDisplayMediaUrl(bounty.imageUrl, "");
  const statusClass = bounty.status === "OPEN"
    ? "trade-status-chip is-open"
    : bounty.status === "MATCHED" || bounty.status === "FULFILLED"
      ? "trade-status-chip is-matched"
      : bounty.status === "PAUSED"
        ? "trade-status-chip is-paused"
        : "trade-status-chip is-closed";

  return {
    href: `/bounties/${encodeURIComponent(bounty.id)}`,
    imageUrl,
    title: bounty.title,
    badgeLabel: bounty.status === "OPEN" ? "Bounty" : bounty.status,
    badgeClassName: statusClass,
    priceLabel: bountyBudgetLabel(bounty.priceMin, bounty.priceMax),
    activityLabel: typeof bounty.bountyAmount === "number" && bounty.bountyAmount > 0
      ? bountyAmountLabel(bounty.bountyAmount)
      : "Open bounty",
    sellerLabel: bounty.user.displayName ?? bounty.user.username ?? "Collector",
    saveInactiveLabel: "Save bounty",
    saveActiveLabel: "Remove saved bounty",
    hasImage: Boolean(imageUrl),
    statsLabelLeft: null,
    statsLabelRight: null,
  };
}

export function ListingCard(props: ListingCardProps) {
  const isLiveCard = "stream" in props;
  const surfaceKind = "trade" in props
    ? "trade"
    : "bounty" in props
      ? "bounty"
      : isLiveCard
        ? "live"
        : "market";
  const controlledSaved = isLiveCard ? props.saved : undefined;
  const [localSaved, setLocalSaved] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const trade = "trade" in props ? props.trade : undefined;
  const bounty = "bounty" in props ? props.bounty : undefined;
  const stream = "stream" in props ? props.stream : undefined;
  const listing = !("trade" in props) && !("stream" in props) && !("bounty" in props) ? props.listing : undefined;
  const surface = useMemo(() => {
    if (trade) return tradeListingToSurfaceData(trade);
    if (bounty) return bountyListingToSurfaceData(bounty);
    if (stream) return liveListingToSurfaceData(stream);
    return marketListingToSurfaceData(listing!);
  }, [trade, bounty, stream, listing]);
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
    if ("bounty" in props && props.onToggleSave) {
      void props.onToggleSave(props.bounty.id);
      return;
    }
    if ("listing" in props && props.onToggleSave) {
      void props.onToggleSave(props.listing.id);
      return;
    }
    setLocalSaved((prev) => !prev);
  };

  return (
    <article className={`listing-card is-${surfaceKind}-card`}>
      <Link href={surface.href} className="listing-card-link">
        {surface.hasImage ? (
          <Image
            src={imageSrc}
            alt={surface.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="listing-card-img"
            unoptimized
            onError={() => { if (failedSrc !== surface.imageUrl) setFailedSrc(surface.imageUrl); }}
          />
        ) : (
          <div className="listing-card-fallback">
            <span>{surface.badgeLabel}</span>
          </div>
        )}

        <div className="listing-card-gradient-top" aria-hidden="true" />
        <div className="listing-card-gradient" aria-hidden="true" />

        <div className="listing-card-top">
          <span className={`listing-card-badge ${surface.badgeClassName}`}>
            {surface.badgeLabel}
          </span>
        </div>

        <div className="listing-card-body">
          <div className="listing-card-copy">
            <h3 className="listing-card-title">{surface.title}</h3>
            <p className="listing-card-seller">{compactName(surface.sellerLabel)}</p>
          </div>
          <div className="listing-card-stats">
            <div className="listing-card-stat">
              {surface.statsLabelLeft ? <p className="listing-card-stat-label">{surface.statsLabelLeft}</p> : null}
              <p className="listing-card-stat-value">{surface.priceLabel}</p>
            </div>
            <div className="listing-card-stat is-right">
              {surface.statsLabelRight ? <p className="listing-card-stat-label">{surface.statsLabelRight}</p> : null}
              <p className="listing-card-stat-value">{surface.activityLabel}</p>
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
        className={`listing-card-watch${saved ? " is-active" : ""}`}
        aria-label={saved ? surface.saveActiveLabel : surface.saveInactiveLabel}
      >
        {saved ? "♥" : "♡"}
      </button>
    </article>
  );
}
