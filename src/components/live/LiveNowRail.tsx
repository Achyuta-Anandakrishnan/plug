import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  return (
    <section id="live-now" className="live-v3-live-now">
      <div className="live-v3-section-head">
        <div>
          <p>Live now</p>
          <h2>Popular streams happening right now</h2>
        </div>
      </div>

      {loading ? (
        <div className="live-v3-empty">Loading live streams...</div>
      ) : streams.length === 0 ? (
        <div className="live-v3-empty">No active streams at the moment.</div>
      ) : (
        <div className="live-v3-rail-wrap">
          <div className="live-v3-rail-fade left" aria-hidden="true" />
          <div className="live-v3-rail-fade right" aria-hidden="true" />
          <div className="live-v3-rail">
            {streams.map((stream) => (
              <div key={stream.id} className="live-v3-rail-item">
                <LiveStreamCard stream={stream} layout="rail" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
