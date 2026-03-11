"use client";

import type { ReactNode } from "react";

type MarketplaceHeaderProps = {
  search: ReactNode;
  tabs: ReactNode;
  filters: ReactNode;
};

export function MarketplaceHeader({ search, tabs, filters }: MarketplaceHeaderProps) {
  return (
    <section className="market-v2-hero">
      <div className="market-v2-hero-head">
        <div>
          <h1 className="market-v2-title">Marketplace</h1>
          <p className="market-v2-subtitle">
            Discover live breaks, auctions, and instant-buy collectibles.
          </p>
        </div>
      </div>

      <div className="market-v2-hero-search">{search}</div>
      <div className="market-v2-hero-tabs">{tabs}</div>
      <div className="market-v2-hero-filters">{filters}</div>
    </section>
  );
}
