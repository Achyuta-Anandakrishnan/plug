import type { LiveStreamItem } from "@/components/live/types";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type UpcomingStreamsSectionProps = {
  streams: LiveStreamItem[];
  reminders: Set<string>;
  onToggleReminder: (streamId: string) => void;
};

export function UpcomingStreamsSection({ streams, reminders, onToggleReminder }: UpcomingStreamsSectionProps) {
  const visibleStreams = streams.slice(0, 8);

  return (
    <section id="upcoming" className="live-v3-upcoming">
      <SectionHeader title="Upcoming" subtitle="Scheduled rooms worth tracking next." />

      {visibleStreams.length === 0 ? (
        <EmptyStateCard title="No upcoming streams scheduled yet." description="Once hosts publish future sessions, they will appear here." />
      ) : (
        <div className={`live-v3-upcoming-grid ${visibleStreams.length < 4 ? "is-sparse" : ""}`}>
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
