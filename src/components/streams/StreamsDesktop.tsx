"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuctionCard } from "@/components/AuctionCard";
import { useAuctions } from "@/hooks/useAuctions";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

export function StreamsDesktop() {
  const [endingSoon, setEndingSoon] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
  });

  const filteredStreams = useMemo(() => {
    let list = [...auctions];

    if (verifiedOnly) {
      list = list.filter((stream) => stream.seller?.status === "APPROVED");
    }

    if (endingSoon) {
      list.sort((a, b) => getTimeLeftSeconds(a) - getTimeLeftSeconds(b));
    }

    return list;
  }, [auctions, endingSoon, verifiedOnly]);

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="space-y-3">
            <h1 className="ios-title">Streams</h1>
          </div>
          <div className="ios-stat-grid">
            <div className="ios-stat-card">
              <p className="ios-stat-label">Visible streams</p>
              <p className="ios-stat-value">{filteredStreams.length}</p>
            </div>
            <div className="ios-stat-card">
              <p className="ios-stat-label">Verified sellers</p>
              <p className="ios-stat-value">
                {filteredStreams.filter((stream) => stream.seller?.status === "APPROVED").length}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="ios-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Refine feed</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEndingSoon((prev) => !prev)}
                  className={`ios-chip ${endingSoon ? "ios-chip-active" : ""}`}
                >
                  Ending soon
                </button>
                <button
                  onClick={() => setVerifiedOnly((prev) => !prev)}
                  className={`ios-chip ${verifiedOnly ? "ios-chip-active" : ""}`}
                >
                  Verified
                </button>
              </div>
            </div>
          </div>

          <Link
            href="/streams/schedule"
            className="ios-panel-muted rounded-[24px] px-4 py-4 text-center text-sm font-semibold text-slate-700"
          >
            Schedule
          </Link>
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
          No live streams yet.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="ios-section-title">Live rooms</h2>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {filteredStreams.length} results
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 min-[520px]:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
