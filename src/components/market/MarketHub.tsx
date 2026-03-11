"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AuctionCard } from "@/components/AuctionCard";
import { CheckersLoader } from "@/components/CheckersLoader";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";

type MarketMode = "all" | "buy-now" | "auctions" | "streams";

const QUICK_CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Pokemon", slug: "pokemon" },
  { label: "Sports", slug: "sports" },
  { label: "Funko", slug: "funko" },
] as const;

const MODE_OPTIONS: Array<{ mode: MarketMode; label: string }> = [
  { mode: "all", label: "All" },
  { mode: "buy-now", label: "Buy now" },
  { mode: "auctions", label: "Auctions" },
  { mode: "streams", label: "Live streams" },
];

function parseMode(value: string | null): MarketMode {
  if (value === "buy-now" || value === "auctions" || value === "streams") {
    return value;
  }
  return "all";
}

function getCategoryKey(slug: string, name: string) {
  const combined = `${slug} ${name}`.toLowerCase();
  if (combined.includes("pokemon")) return "pokemon";
  if (combined.includes("sport")) return "sports";
  if (combined.includes("funko")) return "funko";
  return slug.trim().toLowerCase();
}

function formatModeTitle(mode: MarketMode) {
  if (mode === "buy-now") return "Buy now";
  if (mode === "auctions") return "Auctions";
  if (mode === "streams") return "Live streams";
  return "Marketplace";
}

export function MarketHub() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [buyMessage, setBuyMessage] = useState("");

  const { data: categories } = useCategories();
  const baseOptions = {
    status: "LIVE",
    category: categorySlug || undefined,
    query: query.trim() || undefined,
  } as const;

  const {
    data: liveListings,
    loading: listingsLoading,
    error: listingsError,
  } = useAuctions(baseOptions);

  const {
    data: liveStreams,
    loading: streamsLoading,
  } = useAuctions({
    ...baseOptions,
    view: "streams",
  });

  const filteredListings = useMemo(() => {
    if (modeFromUrl === "buy-now") {
      return liveListings.filter((entry) => entry.listingType !== "AUCTION");
    }

    if (modeFromUrl === "auctions") {
      return liveListings.filter((entry) => entry.listingType !== "BUY_NOW");
    }

    if (modeFromUrl === "streams") {
      return liveStreams;
    }

    return liveListings;
  }, [liveListings, liveStreams, modeFromUrl]);

  const extraCategories = useMemo(() => {
    const seen = new Set<string>(QUICK_CATEGORIES.map((entry) => entry.slug).filter(Boolean));
    const unique = [];
    for (const category of categories) {
      const key = getCategoryKey(category.slug, category.name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(category);
      if (unique.length >= 8) break;
    }
    return unique;
  }, [categories]);

  const liveVerifiedCount = useMemo(
    () => liveStreams.filter((stream) => stream.seller?.status === "APPROVED").length,
    [liveStreams],
  );

  const setMode = (mode: MarketMode) => {
    const next = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      next.delete("mode");
    } else {
      next.set("mode", mode);
    }
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const startBuyNow = async (auctionId: string) => {
    if (!session?.user?.id) {
      await signIn();
      return;
    }

    setBuyLoadingId(auctionId);
    setBuyMessage("");
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
      setBuyMessage("Checkout initialized.");
    } catch (buyError) {
      setBuyMessage(buyError instanceof Error ? buyError.message : "Unable to start checkout.");
    } finally {
      setBuyLoadingId(null);
    }
  };

  const isLoading = listingsLoading || (modeFromUrl === "streams" && streamsLoading);

  return (
    <div className="ios-screen market-shell">
      <section className="ios-hero market-hero space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div className="space-y-2">
            <p className="ios-kicker">Unified market</p>
            <h1 className="ios-title">{formatModeTitle(modeFromUrl)}</h1>
            <p className="ios-subtitle">
              Buy now, auctions, and live streams in one board.
            </p>
          </div>

          <div className="ios-stat-grid">
            <div className="ios-stat-card">
              <p className="ios-stat-label">Live listings</p>
              <p className="ios-stat-value">{liveListings.length}</p>
            </div>
            <div className="ios-stat-card">
              <p className="ios-stat-label">Live streams</p>
              <p className="ios-stat-value">{liveStreams.length}</p>
            </div>
          </div>
        </div>

        <div className="ios-panel market-controls p-3 sm:p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards, players, sets, sellers..."
            className="ios-input"
          />

          <div className="ios-chip-row mt-3">
            {MODE_OPTIONS.map((entry) => (
              <button
                key={entry.mode}
                type="button"
                onClick={() => setMode(entry.mode)}
                className={`ios-chip ${modeFromUrl === entry.mode ? "ios-chip-active" : ""}`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="ios-chip-row mt-2">
            {QUICK_CATEGORIES.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => setCategorySlug(entry.slug)}
                className={`ios-chip ${categorySlug === entry.slug ? "ios-chip-active" : ""}`}
              >
                {entry.label}
              </button>
            ))}
            {extraCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategorySlug(category.slug)}
                className={`ios-chip ${categorySlug === category.slug ? "ios-chip-active" : ""}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ios-panel market-stream-rail p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ios-kicker">Live now</p>
            <p className="text-sm text-slate-600">{liveStreams.length} active streams · {liveVerifiedCount} verified</p>
          </div>
          <button
            type="button"
            onClick={() => setMode("streams")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              modeFromUrl === "streams"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/90 text-slate-700"
            }`}
          >
            Open live
          </button>
        </div>

        {streamsLoading ? (
          <div className="mt-3">
            <CheckersLoader title="Loading live streams..." compact className="ios-empty" />
          </div>
        ) : liveStreams.length === 0 ? (
          <div className="ios-empty mt-3">No live streams right now.</div>
        ) : (
          <div className="market-stream-scroller mt-3">
            {liveStreams.slice(0, 10).map((stream) => {
              const streamImage = resolveDisplayMediaUrl(getPrimaryImageUrl(stream));
              return (
                <Link
                  key={stream.id}
                  href={`/streams/${stream.id}`}
                  className="market-stream-pill"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/20 bg-black/30">
                    <Image
                      src={streamImage}
                      alt={stream.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{stream.title}</p>
                    <p className="text-xs text-slate-500">
                      {stream.watchersCount} watching
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {listingsError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {listingsError}
        </div>
      ) : null}

      {buyMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700">
          {buyMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="market-loading-wrap">
          <CheckersLoader title="Loading market..." className="ios-empty" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="ios-empty">No results in this mode yet.</div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="ios-section-title">{formatModeTitle(modeFromUrl)} feed</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {filteredListings.length} results
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredListings.map((entry) => (
              <div key={entry.id} className="space-y-2">
                <AuctionCard
                  id={entry.id}
                  title={entry.title}
                  sellerName={entry.seller?.user?.displayName ?? "Verified seller"}
                  category={entry.category?.name ?? undefined}
                  currentBid={entry.currentBid}
                  timeLeft={getTimeLeftSeconds(entry)}
                  watchers={entry.watchersCount}
                  badge={entry.seller?.status === "APPROVED" ? "Verified" : "Live"}
                  imageUrl={getPrimaryImageUrl(entry)}
                  listingType={entry.listingType}
                  buyNowPrice={entry.buyNowPrice}
                  currency={entry.currency?.toUpperCase()}
                  gradeLabel={getGradeLabel(entry.item?.attributes) ?? undefined}
                />
                {entry.listingType !== "AUCTION" && entry.buyNowPrice ? (
                  <button
                    type="button"
                    onClick={() => void startBuyNow(entry.id)}
                    disabled={buyLoadingId === entry.id}
                    className="w-full rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                  >
                    {buyLoadingId === entry.id ? "Opening checkout..." : "Buy now"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
