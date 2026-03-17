import type { LiveStreamItem } from "@/components/live/types";
import { ListingCard } from "@/components/market/ListingCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
  limit?: number;
};

export function LiveNowRail({ streams, loading, limit = 24 }: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, limit);

  return (
    <section id="live-now" className="live-v3-live-now">
      {loading ? (
        <EmptyStateCard title="Loading live streams" description="Active rooms will appear here in a moment." />
      ) : visibleStreams.length === 0 ? (
        <EmptyStateCard title="No active streams right now." description="Check back soon or browse upcoming sessions below." />
      ) : (
        <div className="live-v3-live-grid-wrap">
          <SectionHeader title="Live now" subtitle="Join the active rooms on the floor right now." />
          <div className={`live-v3-live-grid ${visibleStreams.length < 3 ? "is-sparse" : ""}`}>
            {visibleStreams.map((stream) => (
              <ListingCard key={stream.id} kind="live" stream={stream} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
