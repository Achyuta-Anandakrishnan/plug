"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { ListingCard } from "@/components/market/ListingCard";
import { ListingGrid } from "@/components/market/ListingGrid";
import type { MarketListing, SortMode } from "@/components/market/types";
import {
  AppPageBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  SearchIcon,
  SectionHeader,
} from "@/components/product/ProductUI";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";
import type { TradePostListItem } from "@/lib/trade-client";

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
  const [showTrades, setShowTrades] = useState(false);
  const [tradePosts, setTradePosts] = useState<TradePostListItem[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState("");
  const tradesAbortRef = useRef<AbortController | null>(null);

  const { data: categories } = useCategories();
  const { auctionIds: savedAuctionIds, toggleAuctionSave, tradePostIds, toggleTradeSave } = useSavedListings();

  useEffect(() => {
    if (!showTrades) return;
    const controller = new AbortController();
    tradesAbortRef.current?.abort();
    tradesAbortRef.current = controller;
    setTradesLoading(true);
    setTradesError("");
    const params = new URLSearchParams({ limit: "80" });
    if (query.trim()) params.set("q", query.trim());
    fetch(`/api/trades?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json().then((data: TradePostListItem[] & { error?: string }) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error ?? "Unable to load trades.");
        setTradePosts(data);
        setTradesLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTradesError(err instanceof Error ? err.message : "Unable to load trades.");
        setTradesLoading(false);
      });
    return () => controller.abort();
  }, [showTrades, query]);

  function handleTradeChip() {
    setShowTrades((prev) => {
      if (!prev) setSelectedCategory("");
      return !prev;
    });
  }

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
              <FilterChip
                key="trade"
                label="For Trade"
                active={showTrades}
                onClick={handleTradeChip}
              />
              {!showTrades && categoryFilters.map((category) => (
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
          {listingsLoading ? <CheckersLoader title="Loading inventory..." compact /> : null}

          {showTrades ? (
            <>
              {tradesLoading ? <CheckersLoader title="Loading trades..." compact /> : null}
              {!tradesLoading ? (
                <section className="mobile-feed-section market-mobile-feed-section">
                  <div className="mobile-feed-section-head">
                    <h2>For Trade</h2>
                    <div className="market-section-actions">
                      <span>{tradePosts.length}</span>
                      <Link href="/trades/new" className="app-button app-button-secondary market-new-trade-btn">+ Post for trade</Link>
                    </div>
                  </div>
                  {tradesError ? (
                    <EmptyStateCard title="Trade board unavailable" description={tradesError} />
                  ) : tradePosts.length === 0 ? (
                    <EmptyStateCard title="No trade posts match." description="Try a different search." />
                  ) : (
                    <div className={`trade-board-grid ${tradePosts.length < 3 ? "is-sparse" : ""}`}>
                      {tradePosts.map((post) => (
                        <ListingCard
                          key={post.id}
                          kind="trade"
                          trade={post}
                          saved={tradePostIds.has(post.id)}
                          onToggleSave={toggleTradeSave}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
            </>
          ) : (
            <>
              {listingsLoading ? null : (
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
              )}
              {listingsLoading ? <CheckersLoader title="Loading inventory..." compact /> : null}
            </>
          )}
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="market-page listing-system-page app-page--market">
      <section className="app-section market-overview">
        <AppPageBar title="Marketplace">
          <div className="app-search">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards, sets, players, cert numbers"
            />
          </div>
          <div className="app-chip-row">
            <FilterChip
              key="trade"
              label="For Trade"
              active={showTrades}
              onClick={handleTradeChip}
            />
            {!showTrades && categoryFilters.map((category) => (
              <FilterChip
                key={category.id}
                label={category.label}
                active={selectedCategory === category.slug}
                onClick={() => setSelectedCategory(selectedCategory === category.slug ? "" : category.slug)}
              />
            ))}
          </div>
          <div className="app-toolbar-spacer" aria-hidden="true" />
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
        </AppPageBar>

        {listingsError ? <EmptyStateCard title="Marketplace unavailable" description={listingsError} /> : null}
      </section>

      <section className="app-section listing-system-feed market-inventory-section">
        {showTrades ? (
          <>
            <SectionHeader
              title="For Trade"
              subtitle="Items listed for trade by collectors."
              action={
                <div className="market-section-actions">
                  <span className="market-count">{tradePosts.length} posts</span>
                  <Link href="/trades/new" className="app-button app-button-secondary market-new-trade-btn">+ Post for trade</Link>
                </div>
              }
            />
            {tradesLoading ? (
              <CheckersLoader title="Loading trades..." compact />
            ) : tradesError ? (
              <EmptyStateCard title="Trade board unavailable" description={tradesError} />
            ) : tradePosts.length === 0 ? (
              <EmptyStateCard title="No trade posts match." description="Try a different search." />
            ) : (
              <div className={`trade-board-grid ${tradePosts.length < 3 ? "is-sparse" : ""}`}>
                {tradePosts.map((post) => (
                  <ListingCard
                    key={post.id}
                    kind="trade"
                    trade={post}
                    saved={tradePostIds.has(post.id)}
                    onToggleSave={toggleTradeSave}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {listingsLoading ? (
              <CheckersLoader title="Loading inventory..." compact />
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
          </>
        )}
      </section>
    </PageContainer>
  );
}
