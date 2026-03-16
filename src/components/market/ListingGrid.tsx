"use client";

import type { MarketListing } from "@/components/market/types";
import { ListingCard } from "@/components/market/ListingCard";

type ListingGridProps = {
  listings: MarketListing[];
  buyLoadingId: string | null;
  onBuyNow: (auctionId: string) => void;
};

export function ListingGrid({ listings, buyLoadingId, onBuyNow }: ListingGridProps) {
  const sparse = listings.length > 0 && listings.length < 4;

  return (
    <div className={`market-v2-grid ${sparse ? "is-sparse" : ""}`}>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          buyLoading={buyLoadingId === listing.id}
          onBuyNow={onBuyNow}
        />
      ))}
    </div>
  );
}
