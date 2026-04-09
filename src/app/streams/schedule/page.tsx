export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { EmptyStateCard, PageContainer, PageHeader } from "@/components/product/ProductUI";

type ScheduleEntry = {
  id: string;
  title: string;
  startTime: Date | null;
  sellerName: string;
  status: string;
};

function dayKey(date: Date | null) {
  if (!date) return "TBD";
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date | null) {
  if (!date) return "TBD";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(date: Date | null) {
  if (!date) return "Time pending";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function StreamSchedulePage() {
  const auctions = await prisma.auction.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      createdAt: true,
      status: true,
      seller: {
        select: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    take: 40,
  });

  const entries: ScheduleEntry[] = auctions.map((auction) => ({
    id: auction.id,
    title: auction.title,
    startTime: auction.startTime,
    sellerName: auction.seller.user.displayName ?? "Verified seller",
    status: auction.status,
  }));

  const grouped = entries.reduce<Record<string, ScheduleEntry[]>>((acc, entry) => {
    const key = dayKey(entry.startTime);
    acc[key] = acc[key] ?? [];
    acc[key].push(entry);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "TBD") return 1;
    if (b === "TBD") return -1;
    return a.localeCompare(b);
  });

  return (
    <PageContainer className="streams-schedule-page app-page--streams-schedule">
      <section className="app-section">
        <PageHeader
          title="Schedule"
          subtitle="Upcoming and currently live sessions across the floor."
        />

        {sortedKeys.length === 0 ? (
          <EmptyStateCard title="No scheduled streams yet." description="Once hosts publish sessions, they will appear here." />
        ) : (
          <div className="schedule-day-list">
            {sortedKeys.map((key) => {
              const firstTime = key === "TBD" ? null : new Date(`${key}T00:00:00`);
              const dayEntries = grouped[key];
              return (
                <div key={key} className="schedule-day-group">
                  <div className="schedule-day-head">
                    <p className="schedule-day-label">{dayLabel(firstTime)}</p>
                    <span className="market-count">
                      {dayEntries.length} stream{dayEntries.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="schedule-entry-list">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="schedule-entry">
                        <div className="schedule-entry-copy">
                          <p className="schedule-entry-title">{entry.title}</p>
                          <p className="schedule-entry-seller">{entry.sellerName}</p>
                        </div>
                        <div className="schedule-entry-time">
                          <p className="schedule-entry-status">{entry.status}</p>
                          <p className="schedule-entry-clock">{timeLabel(entry.startTime)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
