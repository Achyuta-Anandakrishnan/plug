"use client";

import type { MarketListing } from "@/components/market/types";
import { ListingGrid } from "@/components/market/ListingGrid";

type ListingSectionProps = {
  listings: MarketListing[];
  buyLoadingId: string | null;
  onBuyNow: (auctionId: string) => void;
};

export function ListingSection({ listings, buyLoadingId, onBuyNow }: ListingSectionProps) {
  return (
    <section className="market-v2-listings-section" aria-label="Marketplace listings">
      <div className="market-v2-listings-head">
        <h2 className="market-v2-section-title">Inventory</h2>
        <p className="market-v2-count">{listings.length} items</p>
      </div>

      {listings.length === 0 ? (
        <div className="market-v2-empty">No listings match these filters.</div>
      ) : (
        <ListingGrid
          listings={listings}
          buyLoadingId={buyLoadingId}
          onBuyNow={onBuyNow}
        />
      )}
    </section>
  );
}
