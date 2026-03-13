import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type LiveNowRailProps = {
  streams: LiveStreamItem[];
  loading: boolean;
};

export function LiveNowRail({ streams, loading }: LiveNowRailProps) {
  const visibleStreams = streams.slice(0, 12);
  const useCompactGrid = visibleStreams.length > 0 && visibleStreams.length < 4;

  return (
    <section id="live-now" className="live-v3-live-now">
      <h2 className="live-v3-section-title">Live now</h2>
      {loading ? (
        <div className="live-v3-empty">Loading live streams...</div>
      ) : visibleStreams.length === 0 ? (
        <div className="live-v3-empty">No active streams right now.</div>
      ) : (
        <div className={`live-v3-live-grid ${useCompactGrid ? "is-compact" : ""}`}>
          {visibleStreams.map((stream) => (
            <LiveStreamCard key={stream.id} stream={stream} layout="grid" />
          ))}
        </div>
      )}
    </section>
  );
}
