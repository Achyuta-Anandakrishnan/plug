import type { LiveStreamItem } from "@/components/live/types";
import { ListingCard } from "@/components/market/ListingCard";
import { EmptyStateCard, SectionHeader } from "@/components/product/ProductUI";

type UpcomingStreamsSectionProps = {
  streams: LiveStreamItem[];
  reminders: Set<string>;
  onToggleReminder: (streamId: string) => void;
  limit?: number;
};

export function UpcomingStreamsSection({
  streams,
  reminders,
  onToggleReminder,
  limit = 8,
}: UpcomingStreamsSectionProps) {
  const visibleStreams = streams.slice(0, limit);

  return (
    <section id="upcoming" className="live-v3-upcoming">
      <SectionHeader
        title="Upcoming"
        subtitle="Scheduled rooms worth tracking next."
        action={<span className="market-count">{visibleStreams.length} scheduled</span>}
      />

      {visibleStreams.length === 0 ? (
        <EmptyStateCard title="No upcoming streams scheduled yet." description="Once hosts publish future sessions, they will appear here." />
      ) : (
        <div className={`live-v3-upcoming-grid ${visibleStreams.length < 4 ? "is-sparse" : ""}`}>
          {visibleStreams.map((stream) => (
            <ListingCard
              key={stream.id}
              kind="live"
              stream={stream}
              saved={reminders.has(stream.id)}
              onToggleSave={onToggleReminder}
              saveInactiveLabel="Set reminder"
              saveActiveLabel="Remove reminder"
            />
          ))}
        </div>
      )}
    </section>
  );
}
