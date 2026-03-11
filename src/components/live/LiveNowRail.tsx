import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const featured = streams[0] ?? null;
  const secondary = streams.slice(1, 3);
  const gridItems = streams.slice(0, 12);
  const useCompactGrid = gridItems.length > 0 && gridItems.length < 4;

  return (
    <>
      <section id="live-now" className="live-v3-featured">
        <div className="live-v3-section-head">
          <div>
            <p>Featured live now</p>
            <h2>High-energy streams happening right now</h2>
          </div>
        </div>
        {loading ? (
          <div className="live-v3-empty">Loading live streams...</div>
        ) : !featured ? (
          <div className="live-v3-empty">
            No one is live right now. Follow hosts or schedule a stream to get started.
          </div>
        ) : (
          <div className="live-v3-featured-layout">
            <LiveStreamCard stream={featured} layout="featured" />
            <div className="live-v3-featured-side">
              {secondary.length === 0 ? (
                <div className="live-v3-empty">
                  Waiting for more streams to go live.
                </div>
              ) : (
                secondary.map((stream) => (
                  <LiveStreamCard key={stream.id} stream={stream} layout="compact" />
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <section className="live-v3-live-now">
        <div className="live-v3-section-head">
          <div>
            <p>Live now</p>
            <h2>Popular streams happening right now</h2>
          </div>
          <p className="live-v3-section-copy">Browse active breaks, auctions, and seller shows.</p>
        </div>

        {loading ? (
          <div className="live-v3-empty">Loading live streams...</div>
        ) : gridItems.length === 0 ? (
          <div className="live-v3-empty">No active streams at the moment.</div>
        ) : (
          <div className={`live-v3-live-grid ${useCompactGrid ? "is-compact" : ""}`}>
            {gridItems.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
