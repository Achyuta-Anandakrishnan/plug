"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ListingCard } from "@/components/market/ListingCard";
import { ListingGrid } from "@/components/market/ListingGrid";
import type { MarketListing, MarketMode, SortMode } from "@/components/market/types";
import {
  DiscoveryBar,
  EmptyStateCard,
  FilterChip,
  PageContainer,
  SectionHeader,
  SegmentedControl,
  SecondaryButton,
} from "@/components/product/ProductUI";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";

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

export function MarketHub() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const { data: categories } = useCategories();

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
        .slice(0, 4),
    [liveListings],
  );

  const setMode = (mode: MarketMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      params.delete("mode");
    } else {
      params.set("mode", mode);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const startBuyNow = async (auctionId: string) => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    setBuyLoadingId(auctionId);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/auctions/${auctionId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { error?: string; checkoutUrl?: string | null };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to start checkout.");
      }
      if (payload.checkoutUrl && /^https?:\/\/[^\s]+$/i.test(payload.checkoutUrl)) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setStatusMessage("Checkout started.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setBuyLoadingId(null);
    }
  };

  return (
    <PageContainer className="market-page app-page--market">
      <section className="app-section market-overview">
        <DiscoveryBar className="app-control-bar market-toolbar">
          <div className="app-control-title">Marketplace</div>
          <div className="app-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14m0-2a9 9 0 1 0 5.65 16l4.68 4.67 1.42-1.41-4.67-4.68A9 9 0 0 0 11 2" fill="currentColor" />
            </svg>
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
        </DiscoveryBar>

        {listingsError ? <EmptyStateCard title="Marketplace unavailable" description={listingsError} /> : null}
        {statusMessage ? <div className="app-inline-note">{statusMessage}</div> : null}

        {trendingAuctions.length > 0 || listingsLoading ? (
          <section className="app-section market-discovery-section">
            <SectionHeader
              title="Trending auctions"
              subtitle="Most watched inventory live right now."
              action={<SecondaryButton href="/live">See what is live</SecondaryButton>}
            />
            {listingsLoading ? (
              <EmptyStateCard title="Loading inventory" description="Pulling in the latest listings now." />
            ) : (
              <div className="market-featured-grid">
                {trendingAuctions.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    buyLoading={buyLoadingId === listing.id}
                    onBuyNow={startBuyNow}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>

      <section className="app-section market-inventory-section">
        <SectionHeader
          title="Inventory"
          subtitle="Browse live listings and compare them fast."
          action={<span className="market-count">{sortedListings.length} items</span>}
        />

        {listingsLoading ? (
          <EmptyStateCard title="Loading listings" description="Inventory is on the way." />
        ) : sortedListings.length === 0 ? (
          <EmptyStateCard title="No listings match these filters." description="Try broadening the search, switching modes, or clearing a category." />
        ) : (
          <ListingGrid
            listings={sortedListings}
            buyLoadingId={buyLoadingId}
            onBuyNow={startBuyNow}
          />
        )}
      </section>

      <section className="market-link-strip">
        <div>
          <strong>Prefer real-time browsing?</strong>
          <p>See active rooms and upcoming shows without leaving the marketplace.</p>
        </div>
        <Link href="/live">Open Live</Link>
      </section>
    </PageContainer>
  );
}
