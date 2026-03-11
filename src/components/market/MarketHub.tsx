"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { ListingSection } from "@/components/market/ListingSection";
import { ListingTabs } from "@/components/market/ListingTabs";
import { MarketplaceFilters } from "@/components/market/MarketplaceFilters";
import { MarketplaceHeader } from "@/components/market/MarketplaceHeader";
import { MarketplaceSearch } from "@/components/market/MarketplaceSearch";
import type { GridDensity, MarketListing, MarketMode, SortMode } from "@/components/market/types";
import { getPrimaryImageUrl } from "@/lib/auctions";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

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

export function MarketHub() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [gridDensity, setGridDensity] = useState<GridDensity>("comfortable");
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const { data: categories } = useCategories();

  const categoryFilters = useMemo(() => {
    const base = [
      { id: "all", label: "All", slug: "" },
      { id: "pokemon", label: "Pokemon", slug: "pokemon" },
      { id: "sports", label: "Sports", slug: "sports" },
      { id: "funko", label: "Funko", slug: "funko" },
      { id: "tcg", label: "TCG", slug: "tcg" },
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
      .slice(0, 6)
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

  const newlyListed = useMemo(
    () =>
      [...liveListings]
        .sort((a, b) => parseCreatedAt(b) - parseCreatedAt(a))
        .slice(0, 6),
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
    <div className="market-v2-page">
      <MarketplaceHeader
        search={<MarketplaceSearch value={query} onChange={setQuery} />}
        tabs={<ListingTabs value={modeFromUrl} onChange={setMode} />}
        filters={
          <MarketplaceFilters
            categories={categoryFilters}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sort={sortMode}
            onSortChange={setSortMode}
            density={gridDensity}
            onDensityChange={setGridDensity}
          />
        }
      />

      <div className="market-v2-live-cta">
        <span>Looking for live streams?</span>
        <Link href="/live">See live streams</Link>
      </div>

      {listingsError ? (
        <div className="market-v2-error">{listingsError}</div>
      ) : null}

      {statusMessage ? <div className="market-v2-note">{statusMessage}</div> : null}

      {!listingsLoading ? (
        <section className="market-v2-modules">
          <article className="market-v2-module">
            <div className="market-v2-module-head">
              <div>
                <p className="market-v2-section-kicker">Trending auctions</p>
                <h2 className="market-v2-section-title">Most watched right now</h2>
              </div>
            </div>
            {trendingAuctions.length === 0 ? (
              <div className="market-v2-empty">No trending auctions yet.</div>
            ) : (
              <div className="market-v2-module-grid">
                {trendingAuctions.map((entry) => {
                  const currency = entry.currency?.toUpperCase() || "USD";
                  const image = resolveDisplayMediaUrl(getPrimaryImageUrl(entry), "/placeholders/pokemon-generic.svg");
                  return (
                    <Link key={entry.id} href={`/auctions/${entry.id}`} className="market-v2-module-card">
                      <div className="market-v2-module-thumb">
                        <Image
                          src={image}
                          alt={entry.title}
                          fill
                          sizes="(max-width: 900px) 50vw, 240px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <h3>{entry.title}</h3>
                        <p>{entry.watchersCount} watching</p>
                        <span>{formatCurrency(entry.currentBid, currency)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="market-v2-module">
            <div className="market-v2-module-head">
              <div>
                <p className="market-v2-section-kicker">Newly listed</p>
                <h2 className="market-v2-section-title">Fresh inventory</h2>
              </div>
            </div>
            {newlyListed.length === 0 ? (
              <div className="market-v2-empty">No new listings available.</div>
            ) : (
              <div className="market-v2-module-grid">
                {newlyListed.map((entry) => {
                  const currency = entry.currency?.toUpperCase() || "USD";
                  const image = resolveDisplayMediaUrl(getPrimaryImageUrl(entry), "/placeholders/pokemon-generic.svg");
                  const price = entry.listingType === "AUCTION"
                    ? formatCurrency(entry.currentBid, currency)
                    : formatCurrency(entry.buyNowPrice ?? entry.currentBid, currency);
                  return (
                    <Link key={entry.id} href={`/auctions/${entry.id}`} className="market-v2-module-card">
                      <div className="market-v2-module-thumb">
                        <Image
                          src={image}
                          alt={entry.title}
                          fill
                          sizes="(max-width: 900px) 50vw, 240px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <h3>{entry.title}</h3>
                        <p>{entry.category?.name ?? "Collectible"}</p>
                        <span>{price}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {listingsLoading ? (
        <div className="market-v2-empty">Loading listings...</div>
      ) : (
        <ListingSection
          listings={sortedListings}
          density={gridDensity}
          buyLoadingId={buyLoadingId}
          onBuyNow={(auctionId) => void startBuyNow(auctionId)}
        />
      )}
    </div>
  );
}
