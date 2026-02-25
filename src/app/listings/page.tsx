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
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Listings</h1>
        </div>

        <div className="surface-panel rounded-3xl p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "ALL", label: "All" },
                { key: "BUY_NOW", label: "Buy now" },
                { key: "AUCTION", label: "Auctions" },
              ].map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setTab(entry.key as ListingTab)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    tab === entry.key
                      ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                      : "border-slate-200 bg-white/90 text-slate-600"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              {QUICK_CATEGORIES.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => setCategorySlug(entry.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    categorySlug === entry.slug
                      ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                      : "border-slate-200 bg-white/90 text-slate-600"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
              {additionalCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategorySlug(category.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    categorySlug === category.slug
                      ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                      : "border-slate-200 bg-white/90 text-slate-600"
                  }`}
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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Loading listings...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          No listings match this filter.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
      </section>
    </div>
  );
}
