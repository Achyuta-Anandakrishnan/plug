import type { AuctionListItem } from "@/hooks/useAuctions";

export type MarketMode = "all" | "buy-now" | "auctions";
export type SortMode = "newest" | "ending" | "price-low" | "price-high" | "popular";
export type GridDensity = "comfortable" | "compact";

export type MarketListing = AuctionListItem;
export type MarketStream = AuctionListItem & {
  streamStatus: "live" | "scheduled";
};
