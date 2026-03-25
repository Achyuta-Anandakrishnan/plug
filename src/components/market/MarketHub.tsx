"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SkeletonRail } from "@/components/SkeletonCard";
import { ListingCard } from "@/components/market/ListingCard";
import { ListingGrid } from "@/components/market/ListingGrid";
import type { MarketListing, MarketMode, SortMode } from "@/components/market/types";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  PageHeader,
  SearchIcon,
  SectionHeader,
  SegmentedControl,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";

function parseMode(value: string | null): MarketMode {
  if (value === "buy-now" || value === "auctions") return value;
  return "all";
}

function parsePrice(entry: MarketListing) {
  if (entry.listingType === "AUCTION") return entry.currentBid;
  return entry.buyNowPrice ?? entry.currentBid;
}

function parseCreatedAt(entry: MarketListing) {
  if (!entry.createdAt) return 0;
  const timestamp = new Date(entry.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const MODE_OPTIONS: Array<{ value: MarketMode; label: string }> = [
  { value: "all", label: "All listings" },
  { value: "buy-now", label: "Buy now" },
  { value: "auctions", label: "Auctions" },
];

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [swipeDir, setSwipeDir] = useState<"left" | "right">("right");
  const prevModeIdx = useRef(0);

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

  const baseQuery = {
    category: selectedCategory || undefined,
    query: query.trim() || undefined,
  } as const;

  const {
    data: liveListings,
    loading: listingsLoading,
    error: listingsError,
  } = useAuctions({
    ...baseQuery,
    status: "LIVE",
    view: "listings",
  });

  const listingModeFiltered = useMemo(() => {
    if (modeFromUrl === "buy-now") {
      return liveListings.filter((entry) => entry.listingType !== "AUCTION");
    }
    if (modeFromUrl === "auctions") {
      return liveListings.filter((entry) => entry.listingType !== "BUY_NOW");
    }
    return liveListings;
  }, [liveListings, modeFromUrl]);

  const sortedListings = useMemo(() => {
    const list = [...listingModeFiltered];
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
  }, [listingModeFiltered, sortMode]);

  const trendingAuctions = useMemo(
    () =>
      [...liveListings]
        .filter((entry) => entry.listingType !== "BUY_NOW")
        .sort((a, b) => b.watchersCount - a.watchersCount)
        .slice(0, 6),
    [liveListings],
  );

  const endingSoonListings = useMemo(
    () =>
      [...liveListings]
        .sort((a, b) => {
          const aEnd = new Date(a.extendedTime ?? a.endTime ?? "").getTime();
          const bEnd = new Date(b.extendedTime ?? b.endTime ?? "").getTime();
          const safeA = Number.isFinite(aEnd) ? aEnd : Number.MAX_SAFE_INTEGER;
          const safeB = Number.isFinite(bEnd) ? bEnd : Number.MAX_SAFE_INTEGER;
          return safeA - safeB;
        })
        .slice(0, 6),
    [liveListings],
  );

  const recentlyListed = useMemo(
    () =>
      [...liveListings]
        .sort((a, b) => parseCreatedAt(b) - parseCreatedAt(a))
        .slice(0, 6),
    [liveListings],
  );

  const setMode = (mode: MarketMode) => {
    const nextIdx = MODE_OPTIONS.findIndex((o) => o.value === mode);
    setSwipeDir(nextIdx > prevModeIdx.current ? "right" : "left");
    prevModeIdx.current = nextIdx;
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      params.delete("mode");
    } else {
      params.set("mode", mode);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  if (isMobileUi) {
    const mobileSections = [
      { key: "trending", title: "Trending", items: trendingAuctions },
      { key: "ending", title: "Ending soon", items: endingSoonListings },
      { key: "recent", title: "Recently listed", items: recentlyListed },
    ].filter((section) => section.items.length > 0);

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
              {MODE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={modeFromUrl === option.value}
                  onClick={() => setMode(option.value)}
                />
              ))}
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
            <>
              {mobileSections.map((section) => (
                <section key={section.key} className="mobile-feed-section market-mobile-rail-section">
                  <div className="mobile-feed-section-head">
                    <h2>{section.title}</h2>
                    <span>{section.items.length}</span>
                  </div>
                  <div className="market-rail-grid market-mobile-rail-grid" role="list">
                    {section.items.map((listing) => (
                      <ListingCard
                        key={`${section.key}-${listing.id}`}
                        listing={listing}
                        saved={savedAuctionIds.has(listing.id)}
                        onToggleSave={toggleAuctionSave}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <section key={modeFromUrl} className={`mobile-feed-section market-mobile-feed-section tab-swipe-${swipeDir}`}>
                <div className="mobile-feed-section-head">
                  <h2>Inventory</h2>
                  <span>{sortedListings.length}</span>
                </div>
                {sortedListings.length === 0 ? (
                  <EmptyStateCard
                    title="No listings match right now."
                    description="Try another search, mode, or category."
                  />
                ) : (
                  <ListingGrid
                    listings={sortedListings}
                    savedAuctionIds={savedAuctionIds}
                    onToggleSave={toggleAuctionSave}
                  />
                )}
              </section>
            </>
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
        {isMobileUi ? (
          <section className="mobile-page-toolbar market-mobile-toolbar" aria-label="Marketplace discovery controls">
            <div className="mobile-page-toolbar-top">
              <div className="app-control-title">Market</div>
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
            <div className="app-search market-mobile-search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search listings"
              />
            </div>
            <div className="app-chip-row mobile-page-toolbar-scroll market-mobile-modes">
              {MODE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={modeFromUrl === option.value}
                  onClick={() => setMode(option.value)}
                />
              ))}
            </div>
            <div className="app-chip-row mobile-page-toolbar-scroll">
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
        ) : (
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
              <SegmentedControl options={MODE_OPTIONS} value={modeFromUrl} onChange={setMode} />
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
        )}

        {listingsError ? <EmptyStateCard title="Marketplace unavailable" description={listingsError} /> : null}

        {listingsLoading ? (
          <SkeletonRail count={6} />
        ) : (
          <section className="app-section listing-system-feed market-discovery-section">
            {[
              {
                key: "trending",
                title: "Trending auctions",
                subtitle: "Most watched right now.",
                items: trendingAuctions,
                action: <SecondaryButton href="/live">Open live</SecondaryButton>,
              },
              {
                key: "ending",
                title: "Ending soon",
                subtitle: "Listings closing first.",
                items: endingSoonListings,
              },
              {
                key: "recent",
                title: "Recently listed",
                subtitle: "Fresh inventory hitting the floor.",
                items: recentlyListed,
              },
            ]
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <section key={section.key} className="market-rail-section">
                  <SectionHeader
                    title={section.title}
                    subtitle={isMobileUi ? undefined : section.subtitle}
                    action={isMobileUi ? null : section.action ?? null}
                  />
                  <div className="market-rail-grid" role="list">
                    {section.items.map((listing) => (
                      <ListingCard
                        key={`${section.key}-${listing.id}`}
                        listing={listing}
                        saved={savedAuctionIds.has(listing.id)}
                        onToggleSave={toggleAuctionSave}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </section>
        )}
      </section>

      <section key={modeFromUrl} className={`app-section listing-system-feed market-inventory-section tab-swipe-${swipeDir}`}>
        <SectionHeader
          title="Inventory"
          subtitle={isMobileUi ? undefined : "Browse active listings and compare them fast."}
          action={<span className="market-count">{sortedListings.length} items</span>}
        />

        {listingsLoading ? (
          <SkeletonRail count={8} />
        ) : sortedListings.length === 0 ? (
          <EmptyStateCard title="No listings match these filters." description="Try broadening the search, switching modes, or clearing a category." />
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
