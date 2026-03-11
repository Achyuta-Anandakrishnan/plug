"use client";

import type { GridDensity, MarketListing } from "@/components/market/types";
import { ListingCard } from "@/components/market/ListingCard";

type ListingGridProps = {
  listings: MarketListing[];
  density: GridDensity;
  buyLoadingId: string | null;
  onBuyNow: (auctionId: string) => void;
};

export function ListingGrid({ listings, density, buyLoadingId, onBuyNow }: ListingGridProps) {
  return (
    <div className={`market-v2-grid ${density === "compact" ? "is-compact" : "is-comfy"}`}>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          density={density}
          buyLoading={buyLoadingId === listing.id}
          onBuyNow={onBuyNow}
        />
      ))}
    </div>
  );
}
