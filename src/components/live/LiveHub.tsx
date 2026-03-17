"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveFilters } from "@/components/live/LiveFilters";
import { LiveNowRail } from "@/components/live/LiveNowRail";
import { StreamerSpotlight } from "@/components/live/StreamerSpotlight";
import type { LiveCategoryFilter, LiveSortMode, LiveStreamItem, LiveStreamTypeFilter, LiveTimingFilter, SpotlightHost } from "@/components/live/types";
import { UpcomingStreamsSection } from "@/components/live/UpcomingStreamsSection";
import { EmptyStateCard, PageContainer } from "@/components/product/ProductUI";
import { categoryMatches, filterByStreamType, isVisibleLiveStream, isVisibleUpcomingStream, searchMatches, sortLiveStreams, sortUpcomingStreams, streamCategory, streamHost, withStreamState } from "@/components/live/utils";
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
) {
  const queryFiltered = items.filter((stream) => searchMatches(stream, query));
  return queryFiltered.filter((stream) => categoryMatches(stream, category));
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
        scheduledData.filter((entry) => isVisibleUpcomingStream(entry, nowMs)),
        "upcoming",
      ),
    [scheduledData, nowMs],
  );

  const visibleLiveStreams = useMemo(
    () => liveStreams.filter((entry) => isVisibleLiveStream(entry)),
    [liveStreams],
  );

  const filteredLive = useMemo(
    () =>
      sortLiveStreams(
        filterByStreamType(applyStreamFilters(visibleLiveStreams, query, category), streamType),
        sort,
      ),
    [visibleLiveStreams, query, category, streamType, sort],
  );

  const filteredUpcoming = useMemo(
    () =>
      sortUpcomingStreams(
        filterByStreamType(applyStreamFilters(upcomingStreams, query, category), streamType),
        sort,
      ),
    [upcomingStreams, query, category, streamType, sort],
  );

  const spotlightHosts = useMemo(
    () => buildSpotlightHosts(filteredLive, filteredUpcoming),
    [filteredLive, filteredUpcoming],
  );

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
  const liveLimit = timing === "live" ? 24 : 12;
  const upcomingLimit = timing === "upcoming" ? 12 : 6;

  return (
    <PageContainer className="live-v3-page live-page listing-system-page app-page--live">
      <LiveFilters
        title="Live"
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

      {loading ? (
        <CheckersLoader title="Loading live sessions..." compact className="live-v3-empty" />
      ) : (
        <div className="listing-system-feed">
          <LiveNowRail streams={filteredLive} loading={liveLoading} limit={liveLimit} />
        </div>
      )}

      {loading ? (
        <CheckersLoader title="Loading upcoming sessions..." compact className="live-v3-empty" />
      ) : (
        <div className="listing-system-feed">
          <UpcomingStreamsSection
            streams={filteredUpcoming}
            reminders={reminders}
            onToggleReminder={onToggleReminder}
            limit={upcomingLimit}
          />
        </div>
      )}

      {loading ? (
        <CheckersLoader title="Loading host activity..." compact className="live-v3-empty" />
      ) : (
        <div className="listing-system-feed">
          <StreamerSpotlight hosts={spotlightHosts} />
        </div>
      )}

      {hasError ? <EmptyStateCard title="Live data is partially unavailable." description="Some streams or hosts may be missing until the feed reconnects." /> : null}
    </PageContainer>
  );
}
