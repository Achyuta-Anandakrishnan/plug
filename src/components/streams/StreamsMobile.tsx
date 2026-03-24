"use client";

import { useEffect, useMemo, useState } from "react";
import { AuctionCard } from "@/components/AuctionCard";
import { CheckersLoader } from "@/components/CheckersLoader";
import { useAuctions } from "@/hooks/useAuctions";
import {
  getGradeLabel,
  getPrimaryImageUrl,
  getTimeLeftSeconds,
} from "@/lib/auctions";

function formatStart(value: string | null) {
  if (!value) return "Time pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time pending";
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StreamsMobile() {
  const [endingSoon, setEndingSoon] = useState(false);
  const { data: auctions, loading, error } = useAuctions({
    status: "LIVE",
    view: "streams",
  });
  const { data: scheduled } = useAuctions({
    status: "SCHEDULED",
    view: "streams",
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const scheduledFuture = useMemo(
    () =>
      scheduled.filter(
        (entry) => entry.startTime && new Date(entry.startTime).getTime() > nowMs,
      ),
    [scheduled, nowMs],
  );

  const filteredStreams = useMemo(() => {
    const list = [...auctions];
    if (endingSoon) {
      list.sort((a, b) => getTimeLeftSeconds(a) - getTimeLeftSeconds(b));
    }
    return list;
  }, [auctions, endingSoon]);

  return (
    <div className="streams-mobile-screen">
      <section className="streams-mobile-hero">
        <h1 className="app-page-title">Streams</h1>

        <div className="streams-mobile-stats">
          <div className="streams-stat-card">
            <p className="app-eyebrow">Live rooms</p>
            <strong className="streams-stat-value">{filteredStreams.length}</strong>
          </div>
          <div className="streams-stat-card">
            <p className="app-eyebrow">Verified sellers</p>
            <strong className="streams-stat-value">
              {filteredStreams.filter((s) => s.seller?.status === "APPROVED").length}
            </strong>
          </div>
        </div>

        <div className="streams-mobile-filters">
          <p className="streams-mobile-filters-label">Filter</p>
          <button
            type="button"
            onClick={() => setEndingSoon((prev) => !prev)}
            className={`app-chip${endingSoon ? " is-active" : ""}`}
          >
            Ending soon
          </button>
        </div>
      </section>

      {scheduledFuture.length > 0 ? (
        <section className="streams-mobile-scheduled">
          <h2 className="app-section-title">Scheduled</h2>
          <div className="streams-scheduled-list">
            {scheduledFuture.slice(0, 4).map((entry) => (
              <div key={entry.id} className="streams-scheduled-item">
                <p className="streams-scheduled-title">{entry.title}</p>
                <p className="streams-scheduled-time">{formatStart(entry.startTime)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="app-status-note is-error">{error}</p>
      ) : null}

      {loading ? (
        <CheckersLoader title="Loading live rooms…" compact />
      ) : null}

      {!loading && filteredStreams.length === 0 ? (
        <p className="app-status-note">No live rooms right now. Check back soon.</p>
      ) : null}

      {filteredStreams.length > 0 ? (
        <section className="streams-mobile-feed">
          <div className="streams-mobile-feed-head">
            <h2 className="app-section-title">Live rooms</h2>
            <span className="market-count">{filteredStreams.length} active</span>
          </div>
          <div className="streams-mobile-grid">
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
      ) : null}
    </div>
  );
}
