"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import { ListingSection } from "@/components/market/ListingSection";
import { ListingTabs } from "@/components/market/ListingTabs";
import { LiveNowRail } from "@/components/market/LiveNowRail";
import { MarketplaceFilters } from "@/components/market/MarketplaceFilters";
import { MarketplaceHeader } from "@/components/market/MarketplaceHeader";
import { MarketplaceSearch } from "@/components/market/MarketplaceSearch";
import type { GridDensity, MarketListing, MarketMode, MarketStream, SortMode } from "@/components/market/types";

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
  const [endingStreamId, setEndingStreamId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const canManageStreams = session?.user?.role === "SELLER" || session?.user?.role === "ADMIN";
  const currentUserId = session?.user?.id ?? null;

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
    refresh: refreshListings,
  } = useAuctions({
    ...baseQuery,
    status: "LIVE",
    view: "listings",
  });

  const {
    data: liveStreams,
    loading: liveStreamsLoading,
    refresh: refreshLiveStreams,
  } = useAuctions({
    ...baseQuery,
    status: "LIVE",
    view: "streams",
  });

  const {
    data: scheduledStreams,
    loading: scheduledStreamsLoading,
    refresh: refreshScheduledStreams,
  } = useAuctions({
    ...baseQuery,
    status: "SCHEDULED",
    view: "streams",
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

  const streamItems = useMemo<MarketStream[]>(() => {
    const now = Date.now();
    const scheduledFuture = scheduledStreams
      .filter((entry) => entry.startTime && new Date(entry.startTime).getTime() > now)
      .map((entry) => ({ ...entry, streamStatus: "scheduled" as const }));

    const live = liveStreams.map((entry) => ({ ...entry, streamStatus: "live" as const }));

    const seen = new Set<string>();
    const merged = [...live, ...scheduledFuture].filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });

    merged.sort((a, b) => {
      if (a.streamStatus !== b.streamStatus) {
        return a.streamStatus === "live" ? -1 : 1;
      }
      if (a.streamStatus === "live" && b.streamStatus === "live") {
        return b.watchersCount - a.watchersCount;
      }
      const aStart = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });

    return merged;
  }, [liveStreams, scheduledStreams]);

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

  const refreshAllSections = async () => {
    await Promise.all([refreshListings(), refreshLiveStreams(), refreshScheduledStreams()]);
  };

  const endStream = async (auctionId: string) => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    setEndingStreamId(auctionId);
    setStatusMessage("");
    try {
      const response = await fetch("/api/streams/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, status: "ENDED" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to end stream.");
      }
      setStatusMessage("Stream ended.");
      await refreshAllSections();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to end stream.");
    } finally {
      setEndingStreamId(null);
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

      <LiveNowRail
        streams={streamItems}
        loading={liveStreamsLoading || scheduledStreamsLoading}
        currentUserId={currentUserId}
        canManage={canManageStreams}
        endingStreamId={endingStreamId}
        onEnd={(auctionId) => void endStream(auctionId)}
      />

      {listingsError ? (
        <div className="market-v2-error">{listingsError}</div>
      ) : null}

      {statusMessage ? <div className="market-v2-note">{statusMessage}</div> : null}

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
