"use client";

import Link from "next/link";
import type { MarketStream } from "@/components/market/types";
import { LiveStreamCard } from "@/components/market/LiveStreamCard";

type LiveNowRailProps = {
  streams: MarketStream[];
  loading: boolean;
  currentUserId: string | null;
  canManage: boolean;
  endingStreamId: string | null;
  onEnd: (auctionId: string) => void;
};

export function LiveNowRail({
  streams,
  loading,
  currentUserId,
  canManage,
  endingStreamId,
  onEnd,
}: LiveNowRailProps) {
  return (
    <section id="live-now" className="market-v2-live-section" aria-label="Live now streams">
      <div className="market-v2-live-head">
        <div>
          <p className="market-v2-section-kicker">Live Now</p>
          <h2 className="market-v2-section-title">Popular live streams happening right now</h2>
        </div>

        {canManage ? (
          <Link href="/streams/schedule" className="market-v2-manage-link">
            Manage streams
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="market-v2-empty">Loading streams...</div>
      ) : streams.length === 0 ? (
        <div className="market-v2-empty">No live or scheduled streams.</div>
      ) : (
        <div className="market-v2-rail-wrap">
          <div className="market-v2-rail-fade left" aria-hidden="true" />
          <div className="market-v2-rail-fade right" aria-hidden="true" />

          <div className="market-v2-rail" role="list">
            {streams.map((stream) => {
              const isHost =
                Boolean(currentUserId) &&
                Boolean(stream.seller?.user?.id) &&
                stream.seller?.user?.id === currentUserId;
              const canEnd = stream.streamStatus === "live" && Boolean(isHost);
              return (
                <div key={stream.id} role="listitem" className="market-v2-rail-item">
                  <LiveStreamCard
                    stream={stream}
                    canEnd={canEnd}
                    ending={endingStreamId === stream.id}
                    onEnd={onEnd}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
