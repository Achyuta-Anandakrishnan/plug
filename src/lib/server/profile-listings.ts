"server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const profileListingSelect = {
  id: true,
  title: true,
  status: true,
  listingType: true,
  currentBid: true,
  buyNowPrice: true,
  currency: true,
  endTime: true,
  category: { select: { name: true } },
  item: {
    select: {
      images: {
        orderBy: { createdAt: "asc" as const },
        take: 1,
        select: { url: true },
      },
    },
  },
  orders: {
    where: { status: { notIn: ["CANCELED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { amount: true },
  },
} satisfies Prisma.AuctionSelect;

export type ProfileListing = Prisma.AuctionGetPayload<{
  select: typeof profileListingSelect;
}>;

export async function getProfileListings(sellerProfileId: string) {
  const activeWhere: Prisma.AuctionWhereInput = {
    sellerId: sellerProfileId,
    status: { in: ["LIVE", "SCHEDULED"] },
  };
  const salesWhere: Prisma.AuctionWhereInput = {
    sellerId: sellerProfileId,
    status: "ENDED",
  };

  const [activeListings, activeCount, saleHistory, salesCount] = await Promise.all([
    prisma.auction.findMany({
      where: activeWhere,
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: profileListingSelect,
    }),
    prisma.auction.count({ where: activeWhere }),
    prisma.auction.findMany({
      where: salesWhere,
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: profileListingSelect,
    }),
    prisma.auction.count({ where: salesWhere }),
  ]);

  return {
    activeListings,
    activeCount,
    saleHistory,
    salesCount,
  };
}

export function getProfileListingPrice(listing: ProfileListing) {
  const settledAmount = listing.orders[0]?.amount;
  if (typeof settledAmount === "number") {
    return settledAmount;
  }
  if (listing.listingType === "AUCTION") {
    return listing.currentBid;
  }
  return listing.buyNowPrice ?? listing.currentBid;
}
