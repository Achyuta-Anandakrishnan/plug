import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";

type UpcomingStreamsSectionProps = {
  streams: LiveStreamItem[];
  reminders: Set<string>;
  onToggleReminder: (streamId: string) => void;
};

export function UpcomingStreamsSection({ streams, reminders, onToggleReminder }: UpcomingStreamsSectionProps) {
  return (
    <section id="upcoming" className="live-v3-upcoming">
      <div className="live-v3-section-head">
        <div>
          <p>Upcoming streams</p>
          <h2>Plan your next session</h2>
        </div>
      </div>

      {streams.length === 0 ? (
        <div className="live-v3-empty">No upcoming streams scheduled yet.</div>
      ) : (
        <div className="live-v3-upcoming-grid">
          {streams.slice(0, 8).map((stream) => (
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
