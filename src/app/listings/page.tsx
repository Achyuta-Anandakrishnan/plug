"use client";

import { useMemo, useState } from "react";
import { AuctionCard } from "@/components/AuctionCard";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

type ListingTab = "ALL" | "BUY_NOW" | "AUCTION";

const QUICK_CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Pokemon", slug: "pokemon" },
  { label: "Sports", slug: "sports" },
  { label: "Funko Pops", slug: "funko" },
];

function getCategoryKey(slug: string, name: string) {
  const combined = `${slug} ${name}`.toLowerCase();
  if (combined.includes("pokemon")) return "pokemon";
  if (combined.includes("sport")) return "sports";
  if (combined.includes("funko")) return "funko";
  return slug.trim().toLowerCase();
}

export default function ListingsPage() {
  const [tab, setTab] = useState<ListingTab>("ALL");
  const [categorySlug, setCategorySlug] = useState("");
  const { data: categories } = useCategories();
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
    view: "listings",
    category: categorySlug || undefined,
  });

  const filtered = useMemo(() => {
    if (tab === "ALL") return auctions;
    if (tab === "BUY_NOW") {
      return auctions.filter((entry) => entry.listingType !== "AUCTION");
    }
    return auctions.filter((entry) => entry.listingType !== "BUY_NOW");
  }, [auctions, tab]);

  const additionalCategories = useMemo(() => {
    const seen = new Set(QUICK_CATEGORIES.map((entry) => entry.slug).filter(Boolean));
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

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-4">
        <div className="space-y-3">
          <p className="ios-kicker">Market inventory</p>
          <h1 className="ios-title">Listings</h1>
          <p className="ios-subtitle">
            Browse live inventory with tighter filters and a cleaner reading
            rhythm for mobile.
          </p>
        </div>

        <div className="ios-panel p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="ios-chip-row">
              {[
                { key: "ALL", label: "All" },
                { key: "BUY_NOW", label: "Buy now" },
                { key: "AUCTION", label: "Auctions" },
              ].map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setTab(entry.key as ListingTab)}
                  className={`ios-chip ${tab === entry.key ? "ios-chip-active" : ""}`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="ios-chip-row md:justify-end">
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
              {additionalCategories.map((category) => (
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
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="ios-empty">
          Loading listings...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="ios-empty">
          No listings match this filter.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="ios-kicker">Visible now</p>
            <h2 className="ios-section-title">Live inventory</h2>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {filtered.length} results
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {filtered.map((auction) => (
          <AuctionCard
            key={auction.id}
            id={auction.id}
            title={auction.title}
            sellerName={auction.seller?.user?.displayName ?? "Verified seller"}
            category={auction.category?.name ?? undefined}
            currentBid={auction.currentBid}
            timeLeft={getTimeLeftSeconds(auction)}
            watchers={auction.watchersCount}
            badge={auction.seller?.status === "APPROVED" ? "Verified" : "Listing"}
            imageUrl={getPrimaryImageUrl(auction)}
            listingType={auction.listingType}
            buyNowPrice={auction.buyNowPrice}
            currency={auction.currency?.toUpperCase()}
            gradeLabel={getGradeLabel(auction.item?.attributes) ?? undefined}
          />
        ))}
        </div>
      </section>
    </div>
  );
}
