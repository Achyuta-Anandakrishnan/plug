import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type UpcomingStreamsSectionProps = {
  streams: LiveStreamItem[];
  reminders: Set<string>;
  onToggleReminder: (streamId: string) => void;
};

export function UpcomingStreamsSection({ streams, reminders, onToggleReminder }: UpcomingStreamsSectionProps) {
  const visibleStreams = streams.slice(0, 8);

  return (
    <section id="upcoming" className="live-v3-upcoming">
      <h2 className="live-v3-section-title">Upcoming</h2>

      {visibleStreams.length === 0 ? (
        <div className="live-v3-empty">
          No upcoming streams scheduled yet.
        </div>
      ) : (
        <div className="live-v3-upcoming-grid">
          {visibleStreams.map((stream) => (
            <LiveStreamCard
              key={stream.id}
              stream={stream}
              layout="grid"
              showScheduleAction
              reminderOn={reminders.has(stream.id)}
              onToggleReminder={onToggleReminder}
            />
          ))}
        </div>
      )}
    </section>
  );
}
