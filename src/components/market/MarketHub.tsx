"use client";

import { useMemo, useState } from "react";
import { SkeletonRail } from "@/components/SkeletonCard";
import { ListingCard } from "@/components/market/ListingCard";
import { ListingGrid } from "@/components/market/ListingGrid";
import type { MarketListing, SortMode } from "@/components/market/types";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PageHeader,
  SearchIcon,
  SectionHeader,
} from "@/components/product/ProductUI";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";

function parsePrice(entry: MarketListing) {
  if (entry.listingType === "AUCTION") return entry.currentBid;
  return entry.buyNowPrice ?? entry.currentBid;
}

function parseCreatedAt(entry: MarketListing) {
  if (!entry.createdAt) return 0;
  const timestamp = new Date(entry.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "ending", label: "Ending soon" },
  { value: "price-low", label: "Price low" },
  { value: "price-high", label: "Price high" },
  { value: "popular", label: "Most watched" },
];

type MarketHubProps = {
  initialIsMobile?: boolean;
};

export function MarketHub({ initialIsMobile }: MarketHubProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const { data: categories } = useCategories();
  const { auctionIds: savedAuctionIds, toggleAuctionSave } = useSavedListings();

  const categoryFilters = useMemo(() => {
    const base = [
      { id: "all", label: "All", slug: "" },
      { id: "pokemon", label: "Pokemon", slug: "pokemon" },
      { id: "sports", label: "Sports", slug: "sports" },
      { id: "anime", label: "Anime", slug: "anime" },
      { id: "funko", label: "Funko", slug: "funko" },
      { id: "vintage", label: "Vintage", slug: "vintage" },
    ];
    const seen = new Set(base.map((entry) => entry.slug).filter(Boolean));
    const extras = categories
      .filter((category) => {
        const slug = category.slug.toLowerCase();
        if (seen.has(slug)) return false;
        seen.add(slug);
        return true;
      })
      .slice(0, 4)
      .map((category) => ({ id: category.id, label: category.name, slug: category.slug }));
    return [...base, ...extras];
  }, [categories]);

  const {
    data: liveListings,
    loading: listingsLoading,
    error: listingsError,
  } = useAuctions({
    category: selectedCategory || undefined,
    query: query.trim() || undefined,
    status: "LIVE",
    view: "listings",
  });

  const sortedListings = useMemo(() => {
    const list = [...liveListings];
    if (sortMode === "price-low") {
      list.sort((a, b) => parsePrice(a) - parsePrice(b));
      return list;
    }
    if (sortMode === "price-high") {
      list.sort((a, b) => parsePrice(b) - parsePrice(a));
      return list;
    }
    if (sortMode === "ending") {
      list.sort((a, b) => {
        const aEnd = new Date(a.extendedTime ?? a.endTime ?? "").getTime();
        const bEnd = new Date(b.extendedTime ?? b.endTime ?? "").getTime();
        const safeA = Number.isFinite(aEnd) ? aEnd : Number.MAX_SAFE_INTEGER;
        const safeB = Number.isFinite(bEnd) ? bEnd : Number.MAX_SAFE_INTEGER;
        return safeA - safeB;
      });
      return list;
    }
    if (sortMode === "popular") {
      list.sort((a, b) => b.watchersCount - a.watchersCount);
      return list;
    }
    list.sort((a, b) => parseCreatedAt(b) - parseCreatedAt(a));
    return list;
  }, [liveListings, sortMode]);

  if (isMobileUi) {
    return (
      <PageContainer className="market-page listing-system-page app-page--market market-mobile-page">
        <section className="app-section market-mobile-screen">
          <section className="market-mobile-subheader">
            <div className="market-mobile-search-row">
              <div className="app-search market-mobile-search">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search cards, sets, players"
                />
              </div>
              <label className="app-select-wrap app-select-inline market-mobile-sort">
                <span>Sort</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="app-select"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mobile-page-toolbar-scroll market-mobile-chiprail">
              {categoryFilters.map((category) => (
                <FilterChip
                  key={category.id}
                  label={category.label}
                  active={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
                />
              ))}
            </div>
          </section>

          {listingsError ? <EmptyStateCard title="Marketplace unavailable" description={listingsError} /> : null}
          {listingsLoading ? <SkeletonRail count={4} /> : null}

          {!listingsLoading ? (
            <section className="mobile-feed-section market-mobile-feed-section">
              <div className="mobile-feed-section-head">
                <h2>Inventory</h2>
                <span>{sortedListings.length}</span>
              </div>
              {sortedListings.length === 0 ? (
                <EmptyStateCard
                  title="No listings match right now."
                  description="Try another search or category."
                />
              ) : (
                <ListingGrid
                  listings={sortedListings}
                  savedAuctionIds={savedAuctionIds}
                  onToggleSave={toggleAuctionSave}
                />
              )}
            </section>
          ) : null}
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="market-page listing-system-page app-page--market">
      <PageHeader
        title="Marketplace"
        subtitle="Browse active listings and compare them fast."
      />
      <section className="app-section market-overview">
        <DiscoveryBar className="app-control-bar listing-system-toolbar market-toolbar">
          <div className="listing-system-toolbar-main market-toolbar-main">
            <div className="app-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cards, sets, players, cert numbers"
              />
            </div>
            <div className="app-chip-row">
              {categoryFilters.map((category) => (
                <FilterChip
                  key={category.id}
                  label={category.label}
                  active={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
                />
              ))}
            </div>
          </div>
          <div className="listing-system-toolbar-meta market-toolbar-meta">
            <label className="app-select-wrap app-select-inline">
              <span>Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="app-select"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </DiscoveryBar>

        {listingsError ? <EmptyStateCard title="Marketplace unavailable" description={listingsError} /> : null}
      </section>

      <section className="app-section listing-system-feed market-inventory-section">
        <SectionHeader
          title="Inventory"
          subtitle="Browse active listings and compare them fast."
          action={<span className="market-count">{sortedListings.length} items</span>}
        />

        {listingsLoading ? (
          <SkeletonRail count={8} />
        ) : sortedListings.length === 0 ? (
          <EmptyStateCard
            title="No listings match these filters."
            description="Try broadening the search or clearing a category."
          />
        ) : (
          <ListingGrid
            listings={sortedListings}
            savedAuctionIds={savedAuctionIds}
            onToggleSave={toggleAuctionSave}
          />
        )}
      </section>
    </PageContainer>
  );
}
