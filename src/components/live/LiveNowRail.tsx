import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, 16);
  const featuredStreams = visibleStreams.slice(0, 4);
  const gridStreams = visibleStreams.slice(4);
  const useCompactGrid = gridStreams.length > 0 && gridStreams.length < 4;

  return (
    <section id="live-now" className="live-v3-live-now">
      {loading ? (
        <EmptyStateCard title="Loading live streams" description="Active rooms will appear here in a moment." />
      ) : visibleStreams.length === 0 ? (
        <EmptyStateCard title="No active streams right now." description="Check back soon or browse upcoming sessions below." />
      ) : (
        <>
          {featuredStreams.length > 0 ? (
            <div className="live-v3-featured">
              <SectionHeader title="Featured live" subtitle="Join the most active rooms first." />
              <div className="live-v3-featured-grid">
                {featuredStreams.map((stream) => (
                  <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
                ))}
              </div>
            </div>
          ) : null}

          {gridStreams.length > 0 ? (
            <div className="live-v3-live-grid-wrap">
              <SectionHeader title="Live now" subtitle="Browse the rest of the active stream floor." />
              <div className={`live-v3-live-grid ${useCompactGrid ? "is-compact" : ""}`}>
                {gridStreams.map((stream) => (
                  <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
