"use client";

import type { MarketMode } from "@/components/market/types";

const TAB_OPTIONS: Array<{ mode: MarketMode; label: string }> = [
  { mode: "all", label: "All Listings" },
  { mode: "buy-now", label: "Buy Now" },
  { mode: "auctions", label: "Auctions" },
];

type ListingTabsProps = {
  value: MarketMode;
  onChange: (mode: MarketMode) => void;
};

export function ListingTabs({ value, onChange }: ListingTabsProps) {
  return (
    <div className="market-v2-tabs" role="tablist" aria-label="Listing mode tabs">
      {TAB_OPTIONS.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={value === tab.mode}
          onClick={() => onChange(tab.mode)}
          className={`market-v2-tab ${value === tab.mode ? "is-active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
