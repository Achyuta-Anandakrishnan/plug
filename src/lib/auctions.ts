import type { AuctionListItem } from "@/hooks/useAuctions";

type AuctionLike = {
  endTime: string | null;
  extendedTime: string | null;
};

export function getPrimaryImageUrl(auction: AuctionListItem) {
  const images = auction.item?.images ?? [];
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  return primary?.url ?? null;
}

export function getTimeLeftSeconds(auction: AuctionLike) {
  const now = Date.now();
  const endTime = auction.extendedTime ?? auction.endTime;
  if (!endTime) return 0;
  const diff = new Date(endTime).getTime() - now;
  return Math.max(0, Math.floor(diff / 1000));
}
