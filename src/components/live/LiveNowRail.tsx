import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, 16);
  const useCompactGrid = visibleStreams.length > 0 && visibleStreams.length < 3;

  return (
    <section id="live-now" className="live-v3-live-now">
      {loading ? (
        <EmptyStateCard title="Loading live streams" description="Active rooms will appear here in a moment." />
      ) : visibleStreams.length === 0 ? (
        <EmptyStateCard title="No active streams right now." description="Check back soon or browse upcoming sessions below." />
      ) : (
        <div className="live-v3-live-grid-wrap">
          <SectionHeader title="Live now" subtitle="Join the active rooms on the floor right now." />
          <div className={`live-v3-live-grid ${useCompactGrid ? "is-compact" : ""}`}>
            {visibleStreams.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
