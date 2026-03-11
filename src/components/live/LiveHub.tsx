"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveFilters } from "@/components/live/LiveFilters";
import { LiveHero } from "@/components/live/LiveHero";
import { LiveNowRail } from "@/components/live/LiveNowRail";
import { LiveStreamCard } from "@/components/live/LiveStreamCard";
import { LiveValueSection } from "@/components/live/LiveValueSection";
import { StreamerSpotlight } from "@/components/live/StreamerSpotlight";
import type { LiveCategoryFilter, LiveSortMode, LiveStreamItem, LiveStreamTypeFilter, LiveTimingFilter, SpotlightHost } from "@/components/live/types";
import { UpcomingStreamsSection } from "@/components/live/UpcomingStreamsSection";
import { categoryMatches, filterByStreamType, searchMatches, sortLiveStreams, sortUpcomingStreams, streamCategory, streamHost, withStreamState } from "@/components/live/utils";
import { useAuctions } from "@/hooks/useAuctions";

function formatNextStream(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function followerEstimate(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  return 1200 + (positive % 28000);
}

function buildSpotlightHosts(live: LiveStreamItem[], upcoming: LiveStreamItem[]): SpotlightHost[] {
  const map = new Map<string, SpotlightHost>();

  for (const stream of [...live, ...upcoming]) {
    const sellerId = stream.seller?.user?.id ?? `host-${stream.id}`;
    const name = streamHost(stream);
    const profileHref = stream.seller?.user?.id ? `/profiles/${stream.seller.user.id}` : "/explore";
    const existing = map.get(sellerId);
    const streamAt = formatNextStream(stream.startTime);
    if (!existing) {
      map.set(sellerId, {
        id: sellerId,
        name,
        specialty: streamCategory(stream),
        followers: followerEstimate(sellerId),
        isLive: stream.streamState === "live",
        nextStreamAt: stream.streamState === "upcoming" ? streamAt : null,
        profileHref,
        streamHref: `/streams/${stream.id}`,
      });
      continue;
    }

    if (stream.streamState === "live") {
      existing.isLive = true;
      existing.streamHref = `/streams/${stream.id}`;
    }
    if (stream.streamState === "upcoming" && !existing.nextStreamAt) {
      existing.nextStreamAt = streamAt;
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return b.followers - a.followers;
    })
    .slice(0, 6);
}

function applyStreamFilters(
  items: LiveStreamItem[],
  query: string,
  category: LiveCategoryFilter,
  streamType: LiveStreamTypeFilter,
) {
  const queryFiltered = items.filter((stream) => searchMatches(stream, query));
  const categoryFiltered = queryFiltered.filter((stream) => categoryMatches(stream, category));
  return filterByStreamType(categoryFiltered, streamType);
}

export function LiveHub() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LiveCategoryFilter>("all");
  const [streamType, setStreamType] = useState<LiveStreamTypeFilter>("all");
  const [sort, setSort] = useState<LiveSortMode>("viewers");
  const [timing, setTiming] = useState<LiveTimingFilter>("live");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reminders, setReminders] = useState<Set<string>>(new Set());

  const {
    data: liveData,
    loading: liveLoading,
    error: liveError,
  } = useAuctions({
    status: "LIVE",
    view: "streams",
  });

  const {
    data: scheduledData,
    loading: upcomingLoading,
    error: upcomingError,
  } = useAuctions({
    status: "SCHEDULED",
    view: "streams",
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const liveStreams = useMemo(() => withStreamState(liveData, "live"), [liveData]);

  const upcomingStreams = useMemo(
    () =>
      withStreamState(
        scheduledData.filter((entry) => {
          if (!entry.startTime) return false;
          const timestamp = new Date(entry.startTime).getTime();
          return Number.isFinite(timestamp) && timestamp > nowMs;
        }),
        "upcoming",
      ),
    [scheduledData, nowMs],
  );

  const filteredLive = useMemo(
    () => sortLiveStreams(applyStreamFilters(liveStreams, query, category, streamType), sort),
    [liveStreams, query, category, streamType, sort],
  );

  const filteredUpcoming = useMemo(
    () => sortUpcomingStreams(applyStreamFilters(upcomingStreams, query, category, streamType), sort),
    [upcomingStreams, query, category, streamType, sort],
  );

  const featuredStream = filteredLive[0] ?? filteredUpcoming[0] ?? null;
  const liveCategories = useMemo(() => {
    const values = new Set<string>();
    for (const stream of liveStreams) {
      values.add(streamCategory(stream));
    }
    return values.size;
  }, [liveStreams]);

  const spotlightHosts = useMemo(
    () => buildSpotlightHosts(filteredLive, filteredUpcoming),
    [filteredLive, filteredUpcoming],
  );

  const discoveryItems = timing === "live" ? filteredLive : filteredUpcoming;

  const onToggleReminder = (streamId: string) => {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const hasError = liveError || upcomingError;
  const loading = liveLoading || upcomingLoading;

  return (
    <div className="live-v3-page">
      <LiveHero
        featured={featuredStream}
        liveCount={liveStreams.length}
        upcomingCount={upcomingStreams.length}
        activeCategories={liveCategories}
      />

      <LiveNowRail streams={filteredLive.slice(0, 10)} loading={liveLoading} />

      <LiveFilters
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        streamType={streamType}
        onStreamTypeChange={setStreamType}
        sort={sort}
        onSortChange={setSort}
        timing={timing}
        onTimingChange={setTiming}
      />

      <section className="live-v3-discovery">
        <div className="live-v3-section-head">
          <div>
            <p>{timing === "live" ? "Live discovery" : "Upcoming discovery"}</p>
            <h2>{timing === "live" ? "Jump into active streams" : "Find your next stream"}</h2>
          </div>
        </div>
        {loading ? (
          <CheckersLoader title="Loading live sessions..." compact className="live-v3-empty" />
        ) : discoveryItems.length === 0 ? (
          <div className="live-v3-empty">No streams match these filters.</div>
        ) : (
          <div className="live-v3-discovery-grid">
            {discoveryItems.slice(0, 12).map((stream) => (
              <LiveStreamCard
                key={`${timing}-${stream.id}`}
                stream={stream}
                layout="grid"
                showScheduleAction={stream.streamState === "upcoming"}
                reminderOn={reminders.has(stream.id)}
                onToggleReminder={onToggleReminder}
              />
            ))}
          </div>
        )}
      </section>

      <UpcomingStreamsSection
        streams={filteredUpcoming}
        reminders={reminders}
        onToggleReminder={onToggleReminder}
      />

      <StreamerSpotlight hosts={spotlightHosts} />

      <LiveValueSection />

      {hasError ? <div className="live-v3-error">Unable to load parts of live data right now.</div> : null}
    </div>
  );
}
