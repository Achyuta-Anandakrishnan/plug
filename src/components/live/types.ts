import type { AuctionListItem } from "@/hooks/useAuctions";

export type LiveTimingFilter = "live" | "upcoming";
export type LiveSortMode = "viewers" | "ending" | "newest" | "trending";
export type LiveStreamTypeFilter = "all" | "live-breaks" | "auctions" | "seller-shows";
export type LiveCategoryFilter = "all" | "pokemon" | "sports" | "tcg" | "funko" | "vintage";

export type LiveStreamState = "live" | "upcoming";

export type LiveStreamItem = AuctionListItem & {
  streamState: LiveStreamState;
};

export type SpotlightHost = {
  id: string;
  name: string;
  specialty: string;
  followers: number;
  isLive: boolean;
  nextStreamAt: string | null;
  profileHref: string;
  streamHref: string;
};
