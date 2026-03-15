"use client";

import type { MarketListing } from "@/components/market/types";
import { ListingCard } from "@/components/market/ListingCard";
import type { GridDensity } from "@/components/market/types";

type ListingGridProps = {
  listings: MarketListing[];
  buyLoadingId: string | null;
  onBuyNow: (auctionId: string) => void;
  density?: GridDensity;
};

export function ListingGrid({ listings, buyLoadingId, onBuyNow, density = "compact" }: ListingGridProps) {
  const sparse = listings.length > 0 && listings.length < 4;

  return (
    <div className={`market-v2-grid is-${density} ${sparse ? "is-sparse" : ""}`}>
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
