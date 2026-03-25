"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckersLoader } from "@/components/CheckersLoader";
import { LiveFilters } from "@/components/live/LiveFilters";
import { LiveNowRail } from "@/components/live/LiveNowRail";
import type { LiveCategoryFilter, LiveSortMode, LiveStreamItem, LiveTimingFilter } from "@/components/live/types";
import { UpcomingStreamsSection } from "@/components/live/UpcomingStreamsSection";
import { EmptyStateCard, PageContainer, PageHeader } from "@/components/product/ProductUI";
import { useMobileUi } from "@/hooks/useMobileUi";
import { useSavedListings } from "@/hooks/useSavedListings";
import { useStreamReminders } from "@/hooks/useStreamReminders";
import { categoryMatches, isVisibleLiveStream, isVisibleUpcomingStream, searchMatches, sortLiveStreams, sortUpcomingStreams, withStreamState } from "@/components/live/utils";
import { useAuctions } from "@/hooks/useAuctions";

function applyStreamFilters(
  items: LiveStreamItem[],
  query: string,
  category: LiveCategoryFilter,
) {
  const queryFiltered = items.filter((stream) => searchMatches(stream, query));
  return queryFiltered.filter((stream) => categoryMatches(stream, category));
}

type LiveHubProps = {
  initialIsMobile?: boolean;
};

export function LiveHub({ initialIsMobile }: LiveHubProps) {
  const isMobileUi = useMobileUi(initialIsMobile);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LiveCategoryFilter>("all");
  const [sort, setSort] = useState<LiveSortMode>("viewers");
  const [timing, setTiming] = useState<LiveTimingFilter>("live");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { auctionIds: savedAuctionIds, toggleAuctionSave } = useSavedListings();
  const { auctionIds: reminderIds, toggleReminder } = useStreamReminders();

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
    () => sortLiveStreams(applyStreamFilters(visibleLiveStreams, query, category), sort),
    [visibleLiveStreams, query, category, sort],
  );

  const filteredUpcoming = useMemo(
    () => sortUpcomingStreams(applyStreamFilters(upcomingStreams, query, category), sort),
    [upcomingStreams, query, category, sort],
  );

  const hasError = liveError || upcomingError;
  const loading = liveLoading || upcomingLoading;
  const liveLimit = isMobileUi ? 8 : timing === "live" ? 24 : 12;
  const upcomingLimit = isMobileUi ? 4 : timing === "upcoming" ? 12 : 6;

  if (isMobileUi) {
    return (
      <PageContainer className="live-v3-page live-page listing-system-page app-page--live live-mobile-page">
        <LiveFilters
          mobile
          title="Live"
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          timing={timing}
          onTimingChange={setTiming}
        />

        {loading ? (
          <CheckersLoader title="Loading live sessions..." compact className="live-v3-empty" />
        ) : (
          <div className="live-mobile-feed">
            <LiveNowRail
              streams={filteredLive}
              loading={liveLoading}
              limit={liveLimit}
              compact
              savedStreamIds={savedAuctionIds}
              onToggleSave={toggleAuctionSave}
            />

            <UpcomingStreamsSection
              streams={filteredUpcoming}
              reminders={reminderIds}
              onToggleReminder={toggleReminder}
              limit={upcomingLimit}
              compact
            />
          </div>
        )}

        {hasError ? <EmptyStateCard title="Live data is partially unavailable." description="Some streams or hosts may be missing until the feed reconnects." /> : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="live-v3-page live-page listing-system-page app-page--live">
      <PageHeader
        title="Live"
        subtitle="Stream rooms, live auctions, and upcoming shows."
      />
      <LiveFilters
        title="Live"
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
        timing={timing}
        onTimingChange={setTiming}
      />

      {loading ? (
        <CheckersLoader title="Loading live sessions..." compact className="live-v3-empty" />
      ) : (
        <div className="listing-system-feed">
          <LiveNowRail
            streams={filteredLive}
            loading={liveLoading}
            limit={liveLimit}
            compact={isMobileUi}
            savedStreamIds={savedAuctionIds}
            onToggleSave={toggleAuctionSave}
          />
        </div>
      )}

      {loading ? (
        <CheckersLoader title="Loading upcoming sessions..." compact className="live-v3-empty" />
      ) : (
        <div className="listing-system-feed">
          <UpcomingStreamsSection
            streams={filteredUpcoming}
            reminders={reminderIds}
            onToggleReminder={toggleReminder}
            limit={upcomingLimit}
            compact={isMobileUi}
          />
        </div>
      )}

      {hasError ? <EmptyStateCard title="Live data is partially unavailable." description="Some streams or hosts may be missing until the feed reconnects." /> : null}
    </PageContainer>
  );
}
