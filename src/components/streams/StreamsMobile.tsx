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
    view: "streams",
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
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-[32px] text-slate-900">Streams</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/streams/schedule"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600"
          >
            Schedule
          </Link>
          <Link
            href="/streams/roster"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600"
          >
            Roster
          </Link>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEndingSoon((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                endingSoon
                  ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Ending soon
            </button>
            <div className="flex gap-2 overflow-x-auto">
              {["All", ...categories.map((category) => category.name)].map(
                (category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                      activeCategory === category
                        ? "border-[var(--royal)] bg-blue-50 text-[var(--royal)]"
                        : "border-white/70 bg-white/70 text-slate-500"
                    }`}
                  >
                    {category}
                  </button>
                ),
              )}
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
          Loading live listings...
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3">
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
      </section>
    </div>
  );
}
