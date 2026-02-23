"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuctionCard } from "@/components/AuctionCard";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

const QUICK_CATEGORIES = [
  { name: "Pokemon", slug: "pokemon" },
  { name: "Sports", slug: "sports" },
  { name: "Funko Pops", slug: "funko" },
];

export default function ExplorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get("category"),
  );
  const { data: categories, loading: categoriesLoading } = useCategories();
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
    category: activeCategory ?? undefined,
    query: query.trim() || undefined,
  });

  useEffect(() => {
    setActiveCategory(searchParams.get("category"));
  }, [searchParams]);

  const categoryChips = useMemo(() => {
    const quick = QUICK_CATEGORIES.map((entry) => ({
      id: entry.slug,
      name: entry.name,
      slug: entry.slug,
    }));
    const merged = new Map(quick.map((entry) => [entry.slug, entry]));
    categories.slice(0, 12).forEach((entry) => merged.set(entry.slug, entry));
    return Array.from(merged.values());
  }, [categories]);

  const setCategory = (slug: string | null) => {
    setActiveCategory(slug);
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("category", slug);
    else params.delete("category");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Search + explore
        </p>
        <h1 className="font-display text-3xl text-slate-900">Find listings</h1>
      </div>

      <div className="surface-panel rounded-[28px] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pokemon, sneakers, sealed boxes..."
            className="w-full rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[var(--royal)] sm:flex-1"
          />
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_CATEGORIES.map((chip) => (
            <button
              key={chip.slug}
              type="button"
              onClick={() => setCategory(chip.slug)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                activeCategory === chip.slug
                  ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                  : "border-slate-200 bg-white/90 text-slate-600"
              }`}
            >
              {chip.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
              !activeCategory
                ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                : "border-white/70 bg-white/70 text-slate-500"
            }`}
            disabled={categoriesLoading}
          >
            All
          </button>
          {categoryChips.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => setCategory(category.slug)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                activeCategory === category.slug
                  ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                  : "border-white/70 bg-white/70 text-slate-500"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          Searching listings...
        </div>
      )}

      {!loading && auctions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-sm text-slate-500">
          No matches.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {auctions.map((stream) => (
          <AuctionCard
            key={stream.id}
            id={stream.id}
            title={stream.title}
            sellerName={stream.seller?.user?.displayName ?? "Verified seller"}
            category={stream.category?.name ?? undefined}
            currentBid={stream.currentBid}
            timeLeft={getTimeLeftSeconds(stream)}
            watchers={stream.watchersCount}
            badge={stream.seller?.status === "APPROVED" ? "Verified" : "Live"}
            imageUrl={getPrimaryImageUrl(stream)}
            listingType={stream.listingType}
            buyNowPrice={stream.buyNowPrice}
            currency={stream.currency?.toUpperCase()}
            gradeLabel={getGradeLabel(stream.item?.attributes) ?? undefined}
          />
        ))}
      </section>
    </div>
  );
}
