import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, 12);
  const featuredPrimary = visibleStreams[0] ?? null;
  const featuredSecondary = featuredPrimary ? visibleStreams.slice(1, 3) : [];
  const gridStreams = featuredPrimary ? visibleStreams.slice(3) : [];
  const useCompactGrid = gridStreams.length > 0 && gridStreams.length < 4;

  return (
    <section id="live-now" className="live-v3-live-now">
      {loading ? (
        <div className="live-v3-empty">Loading live streams...</div>
      ) : visibleStreams.length === 0 ? (
        <div className="live-v3-empty">No active streams right now.</div>
      ) : (
        <>
          {featuredPrimary ? (
            <div className="live-v3-featured">
              <div className="live-v3-section-head">
                <h2 className="live-v3-section-title">Featured live</h2>
              </div>
              <div className={`live-v3-featured-layout ${featuredSecondary.length === 0 ? "is-solo" : ""}`}>
                <LiveStreamCard stream={featuredPrimary} layout="featured" />
                {featuredSecondary.length > 0 ? (
                  <div className="live-v3-featured-side">
                    {featuredSecondary.map((stream) => (
                      <LiveStreamCard key={stream.id} stream={stream} layout="compact" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {gridStreams.length > 0 ? (
            <div className="live-v3-live-grid-wrap">
              <div className="live-v3-section-head">
                <h2 className="live-v3-section-title">Live now</h2>
              </div>
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
