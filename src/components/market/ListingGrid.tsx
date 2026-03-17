"use client";

import type { MarketListing } from "@/components/market/types";
import { ListingCard } from "@/components/market/ListingCard";

type ListingGridProps = {
  listings: MarketListing[];
  savedAuctionIds?: Set<string>;
  onToggleSave?: (listingId: string) => void | Promise<boolean>;
};

export function ListingGrid({ listings, savedAuctionIds, onToggleSave }: ListingGridProps) {
  const sparse = listings.length > 0 && listings.length < 3;

  return (
    <div className={`market-v2-grid ${sparse ? "is-sparse" : ""}`}>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          saved={savedAuctionIds?.has(listing.id)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
