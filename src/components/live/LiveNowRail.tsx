import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const useCompactGrid = streams.length > 0 && streams.length < 4;

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
        <div className={`live-v3-live-grid ${useCompactGrid ? "is-compact" : ""}`}>
          {streams.map((stream) => (
            <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
          ))}
        </div>
      )}
    </section>
  );
}
