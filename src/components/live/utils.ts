import type { AuctionListItem } from "@/hooks/useAuctions";
import { getPrimaryImageUrl, getTimeLeftSeconds } from "@/lib/auctions";
import { formatCurrency, formatSeconds } from "@/lib/format";
import { resolveDisplayMediaUrl } from "@/lib/media-placeholders";
import type { LiveCategoryFilter, LiveSortMode, LiveStreamItem, LiveStreamTypeFilter, LiveTimingFilter } from "@/components/live/types";

export function streamHost(stream: AuctionListItem) {
  return stream.seller?.user?.displayName ?? "Verified seller";
}

export function streamCategory(stream: AuctionListItem) {
  return stream.category?.name ?? "Collectibles";
}

export function streamImage(stream: AuctionListItem) {
  return resolveDisplayMediaUrl(getPrimaryImageUrl(stream), "/placeholders/pokemon-generic.svg");
}

export function streamType(stream: AuctionListItem): Exclude<LiveStreamTypeFilter, "all"> {
  if (/break/i.test(stream.title)) return "live-breaks";
  if (stream.listingType === "AUCTION" || stream.listingType === "BOTH") return "auctions";
  return "seller-shows";
}

export function streamPriceLabel(stream: AuctionListItem) {
  const currency = stream.currency?.toUpperCase() || "USD";
  if (stream.buyNowPrice && stream.buyNowPrice > 0) {
    return `Buy ${formatCurrency(stream.buyNowPrice, currency)}`;
  }
  return `Bid ${formatCurrency(stream.currentBid, currency)}`;
}

export function streamTimeLabel(stream: LiveStreamItem) {
  if (stream.streamState === "live") {
    return `Ends in ${formatSeconds(getTimeLeftSeconds(stream))}`;
  }
  if (!stream.startTime) return "Time pending";
  const date = new Date(stream.startTime);
  if (Number.isNaN(date.getTime())) return "Time pending";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function streamTypeLabel(type: Exclude<LiveStreamTypeFilter, "all">) {
  if (type === "live-breaks") return "Live breaks";
  if (type === "auctions") return "Auctions";
  return "Seller shows";
}

export function categoryMatches(stream: AuctionListItem, filter: LiveCategoryFilter) {
  if (filter === "all") return true;
  const title = stream.title.toLowerCase();
  const category = streamCategory(stream).toLowerCase();
  const haystack = `${title} ${category}`;

  if (filter === "pokemon") {
    return haystack.includes("pokemon");
  }
  if (filter === "sports") {
    return haystack.includes("sports");
  }
  if (filter === "anime") {
    return haystack.includes("anime")
      || haystack.includes("dragon ball")
      || haystack.includes("one piece")
      || haystack.includes("naruto")
      || haystack.includes("manga");
  }
  if (filter === "funko") {
    return haystack.includes("funko");
  }
  return false;
}

export function searchMatches(stream: AuctionListItem, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    stream.title,
    streamHost(stream),
    streamCategory(stream),
    stream.listingType,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function withStreamState(entries: AuctionListItem[], streamState: "live" | "upcoming"): LiveStreamItem[] {
  return entries.map((entry) => ({ ...entry, streamState }));
}

function streamCreatedTimestamp(stream: AuctionListItem) {
  if (!stream.createdAt) return 0;
  const timestamp = new Date(stream.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function streamStartTimestamp(stream: AuctionListItem) {
  if (!stream.startTime) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(stream.startTime).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function streamTrendScore(stream: AuctionListItem) {
  return (stream.watchersCount * 8) + Math.round(stream.currentBid / 1000);
}

export function sortLiveStreams(items: LiveStreamItem[], sort: LiveSortMode) {
  const list = [...items];
  if (sort === "viewers") {
    list.sort((a, b) => b.watchersCount - a.watchersCount);
    return list;
  }
  if (sort === "ending") {
    list.sort((a, b) => getTimeLeftSeconds(a) - getTimeLeftSeconds(b));
    return list;
  }
  if (sort === "newest") {
    list.sort((a, b) => streamCreatedTimestamp(b) - streamCreatedTimestamp(a));
    return list;
  }
  list.sort((a, b) => streamTrendScore(b) - streamTrendScore(a));
  return list;
}

export function sortUpcomingStreams(items: LiveStreamItem[], sort: LiveSortMode) {
  const list = [...items];
  if (sort === "viewers") {
    list.sort((a, b) => b.watchersCount - a.watchersCount);
    return list;
  }
  if (sort === "ending") {
    list.sort((a, b) => streamStartTimestamp(a) - streamStartTimestamp(b));
    return list;
  }
  if (sort === "newest") {
    list.sort((a, b) => streamCreatedTimestamp(b) - streamCreatedTimestamp(a));
    return list;
  }
  list.sort((a, b) => {
    const aScore = streamTrendScore(a) - Math.round(streamStartTimestamp(a) / 10000000);
    const bScore = streamTrendScore(b) - Math.round(streamStartTimestamp(b) / 10000000);
    return bScore - aScore;
  });
  return list;
}

export function filterByStreamType(streams: LiveStreamItem[], typeFilter: LiveStreamTypeFilter) {
  if (typeFilter === "all") return streams;
  return streams.filter((stream) => streamType(stream) === typeFilter);
}

export function filterByTiming(streams: LiveStreamItem[], timing: LiveTimingFilter) {
  return streams.filter((stream) => stream.streamState === timing);
}
