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
          <div className="product-card trade-dispute-card">
          <div className="grid gap-3">
            {sortedKeys.map((key) => {
              const firstTime = key === "TBD" ? null : new Date(`${key}T00:00:00`);
              const dayEntries = grouped[key];
              return (
                <div key={key} className="ios-panel-muted rounded-[24px] px-4 py-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-base text-slate-900">{dayLabel(firstTime)}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {dayEntries.length} stream{dayEntries.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{entry.title}</p>
                          <p className="truncate text-xs text-slate-500">{entry.sellerName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {entry.status}
                          </p>
                          <p className="text-xs text-slate-500">{timeLabel(entry.startTime)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
