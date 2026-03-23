import type { LiveStreamItem } from "@/components/live/types";
import { ListingCard } from "@/components/market/ListingCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
  limit?: number;
  compact?: boolean;
  savedStreamIds?: Set<string>;
  onToggleSave?: (streamId: string) => void;
};

export function LiveNowRail({
  streams,
  loading,
  limit = 24,
  compact = false,
  savedStreamIds,
  onToggleSave,
}: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, limit);

  return (
    <section id="live-now" className={`live-v3-live-now ${compact ? "is-mobile" : ""}`}>
      {compact ? (
        <div className="mobile-feed-section-head">
          <h2>Live now</h2>
          <span>{visibleStreams.length}</span>
        </div>
      ) : (
        <SectionHeader
          title="Live now"
          action={<span className="market-count">{visibleStreams.length} rooms</span>}
        />
      )}
      {loading ? (
        <EmptyStateCard title="Loading live streams" description="Active rooms will appear here in a moment." />
      ) : visibleStreams.length === 0 ? (
        <EmptyStateCard
          title="No active streams right now."
          description={compact ? "Upcoming sessions will appear below." : "Check back soon or browse upcoming sessions below."}
        />
      ) : (
        <div className="live-v3-live-grid-wrap">
          <div className={`live-v3-live-grid ${visibleStreams.length < 3 ? "is-sparse" : ""}`}>
            {visibleStreams.map((stream) => (
              <ListingCard
                key={stream.id}
                kind="live"
                stream={stream}
                saved={savedStreamIds?.has(stream.id)}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
