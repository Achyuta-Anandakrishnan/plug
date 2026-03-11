"use client";

import { useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { AuctionCard } from "@/components/AuctionCard";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

type SectionKey = "auctions" | "buyNow" | "hybrid";

const QUICK_CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Pokemon", slug: "pokemon" },
  { label: "Sports", slug: "sports" },
  { label: "Funko", slug: "funko" },
];

function getCategoryKey(slug: string, name: string) {
  const combined = `${slug} ${name}`.toLowerCase();
  if (combined.includes("pokemon")) return "pokemon";
  if (combined.includes("sport")) return "sports";
  if (combined.includes("funko")) return "funko";
  return slug.trim().toLowerCase();
}

export function MarketHub() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [buyLoadingId, setBuyLoadingId] = useState<string | null>(null);
  const [buyMessage, setBuyMessage] = useState("");
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>({
    auctions: true,
    buyNow: true,
    hybrid: false,
  });

  const { data: categories } = useCategories();
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
    category: categorySlug || undefined,
    query: query.trim() || undefined,
  });

  const extraCategories = useMemo(() => {
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

  const auctionsOnly = useMemo(
    () => auctions.filter((entry) => entry.listingType === "AUCTION"),
    [auctions],
  );
  const buyNowOnly = useMemo(
    () => auctions.filter((entry) => entry.listingType === "BUY_NOW"),
    [auctions],
  );
  const hybrid = useMemo(
    () => auctions.filter((entry) => entry.listingType === "BOTH"),
    [auctions],
  );

  const toggleSection = (key: SectionKey) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const renderSection = (
    key: SectionKey,
    title: string,
    list: typeof auctions,
    emptyText: string,
  ) => (
    <section className="ios-panel p-4 sm:p-5">
      <button
        type="button"
        onClick={() => toggleSection(key)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="ios-kicker">{title}</p>
          <h2 className="ios-section-title">{list.length} live</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {sectionOpen[key] ? "Collapse" : "Expand"}
        </span>
      </button>

      {sectionOpen[key] ? (
        list.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 min-[540px]:grid-cols-3 xl:grid-cols-4">
            {list.map((entry) => (
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
                    className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
                  >
                    {buyLoadingId === entry.id ? "Opening checkout..." : "Buy now with Stripe"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="ios-empty mt-4">{emptyText}</div>
        )
      ) : null}
    </section>
  );

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-4">
        <div>
          <h1 className="ios-title">Market</h1>
          <p className="ios-subtitle">One place for listings, auctions, and search. Expand sections as needed.</p>
        </div>

        <div className="ios-panel p-4 space-y-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards, players, sets, sellers..."
            className="ios-input"
          />
          <div className="ios-chip-row">
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

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {buyMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700">
          {buyMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="ios-empty">Loading market...</div>
      ) : (
        <>
          {renderSection("auctions", "Auctions", auctionsOnly, "No live auctions.")}
          {renderSection("buyNow", "Buy now", buyNowOnly, "No buy-now listings.")}
          {renderSection("hybrid", "Auction + buy now", hybrid, "No hybrid listings.")}
        </>
      )}
    </div>
  );
}
