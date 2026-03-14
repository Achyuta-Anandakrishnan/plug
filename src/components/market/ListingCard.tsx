"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MarketListing } from "@/components/market/types";
import { getGradeLabel, getPrimaryImageUrl, getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type ListingCardProps = {
  listing: MarketListing;
  buyLoading: boolean;
  onBuyNow: (auctionId: string) => void;
};

export function ListingCard({ listing, buyLoading, onBuyNow }: ListingCardProps) {
  const [watching, setWatching] = useState(false);
  const currency = listing.currency?.toUpperCase() || "USD";
  const grade = getGradeLabel(listing.item?.attributes);
  const fallbackImage = "/placeholders/pokemon-generic.svg";
  const image = useMemo(
    () => resolveDisplayMediaUrl(getPrimaryImageUrl(listing), fallbackImage),
    [listing, fallbackImage],
  );
  const [imageSrc, setImageSrc] = useState(image);
  const price = listing.listingType === "AUCTION"
    ? formatCurrency(listing.currentBid, currency)
    : formatCurrency(listing.buyNowPrice ?? listing.currentBid, currency);
  const badgeLabel = listing.listingType === "BOTH"
    ? "Auction / Buy"
    : listing.listingType.replace("_", " ");
  const metadata = grade || "Grading details pending";
  const timeMeta = listing.listingType === "BUY_NOW"
    ? "Buy now"
    : formatSeconds(getTimeLeftSeconds(listing));

  useEffect(() => {
    setImageSrc(image);
  }, [image]);

  return (
    <article className="market-v2-listing-card product-card listing-card">
      <Link href={`/auctions/${listing.id}`} className="market-v2-listing-link">
        <div className="market-v2-listing-media">
          <Image
            src={imageSrc}
            alt="Listing image"
            fill
            sizes="(max-width: 768px) 46vw, (max-width: 1280px) 30vw, 360px"
            className="object-cover"
            unoptimized
            onError={() => {
              if (imageSrc !== fallbackImage) {
                setImageSrc(fallbackImage);
              }
            }}
          />
        </div>

        <div className="market-v2-listing-body">
          <div className="market-v2-listing-topline">
            <span className="market-v2-listing-badge">{badgeLabel}</span>
            {listing.category?.name ? <span className="market-v2-listing-cat">{listing.category.name}</span> : null}
          </div>

          <h3 className="market-v2-listing-title">{listing.title}</h3>
          <p className="market-v2-listing-meta">{metadata}</p>
          <div className="market-v2-listing-support">
            <span>{listing.seller?.user?.displayName ?? "Verified seller"}</span>
            <span>{listing.watchersCount} watching</span>
          </div>
          <p className="market-v2-listing-price">{price}</p>
        </div>
      </Link>

      <div className="market-v2-listing-footer-row">
        <span className="market-v2-listing-time">{timeMeta}</span>
        <span className="market-v2-listing-watchers">{listing.listingType === "AUCTION" ? "Active bids" : "Buy now"}</span>
        <button
          type="button"
          onClick={() => setWatching((prev) => !prev)}
          className={`market-v2-watch-btn ${watching ? "is-active" : ""}`}
          aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
        >
          {watching ? "♥" : "♡"}
        </button>
      </div>

      {listing.listingType !== "AUCTION" && listing.buyNowPrice ? (
        <button
          type="button"
          onClick={() => onBuyNow(listing.id)}
          disabled={buyLoading}
          className="market-v2-buy-btn"
        >
          {buyLoading ? "Opening..." : "Buy Now"}
        </button>
      ) : null}
    </article>
  );
}
