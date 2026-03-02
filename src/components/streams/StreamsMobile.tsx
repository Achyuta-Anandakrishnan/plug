"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuctionCard } from "@/components/AuctionCard";
import { useAuctions } from "@/hooks/useAuctions";
import { useCategories } from "@/hooks/useCategories";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

export function StreamsMobile() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [endingSoon, setEndingSoon] = useState(false);
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
  });
  const { data: categories } = useCategories();

  const filteredStreams = useMemo(() => {
    let list = [...auctions];

    if (activeCategory !== "All") {
      list = list.filter(
        (stream) => stream.category?.name === activeCategory,
      );
    }

    if (endingSoon) {
      list.sort((a, b) => getTimeLeftSeconds(a) - getTimeLeftSeconds(b));
    }

    return list;
  }, [activeCategory, auctions, endingSoon]);

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-5">
        <div className="space-y-3">
          <p className="ios-kicker">Live floor</p>
          <h1 className="ios-title">Streams</h1>
          <p className="ios-subtitle">
            Jump between live rooms, price action, and seller drops without the
            extra chrome.
          </p>
        </div>

        <div className="ios-stat-grid">
          <div className="ios-stat-card">
            <p className="ios-stat-label">Live rooms</p>
            <p className="ios-stat-value">{filteredStreams.length}</p>
          </div>
          <div className="ios-stat-card">
            <p className="ios-stat-label">Categories</p>
            <p className="ios-stat-value">{categories.length || 1}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/streams/schedule"
            className="ios-panel-muted rounded-[22px] px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Schedule
          </Link>
          <Link
            href="/streams/roster"
            className="ios-panel-muted rounded-[22px] px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Roster
          </Link>
        </div>

        <div className="ios-panel p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Filters</p>
            <button
              onClick={() => setEndingSoon((prev) => !prev)}
              className={`ios-chip ${endingSoon ? "ios-chip-active" : ""}`}
            >
              Ending soon
            </button>
          </div>
          <div className="ios-chip-row">
            {["All", ...categories.map((category) => category.name)].map(
              (category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`ios-chip ${
                    activeCategory === category ? "ios-chip-active" : ""
                  }`}
                >
                  {category}
                </button>
              ),
            )}
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
          Loading live listings...
        </div>
      )}

      {!loading && filteredStreams.length === 0 && (
        <div className="ios-empty">
          No live rooms match this filter yet.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="ios-kicker">Now showing</p>
            <h2 className="ios-section-title">Live rooms</h2>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {filteredStreams.length} active
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredStreams.map((stream) => (
            <AuctionCard
              key={stream.id}
              id={stream.id}
              title={stream.title}
              sellerName={stream.seller?.user?.displayName ?? "Verified seller"}
              category={stream.category?.name}
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
        </div>
      </section>
    </div>
  );
}
