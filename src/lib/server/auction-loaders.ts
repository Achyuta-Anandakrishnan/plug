import "server-only";
import { prisma } from "@/lib/prisma";

export async function getAuctionDetail(id: string) {
  return prisma.auction.findUnique({
    where: { id },
    include: {
      category: true,
      item: { include: { images: true } },
      seller: {
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { displayName: true, id: true } },
        },
      },
      bids: { orderBy: { createdAt: "desc" }, take: 25 },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { sender: { select: { displayName: true } } },
      },
      streamSessions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function getAuctionRoomSnapshot(id: string) {
  return prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      currentBid: true,
      buyNowPrice: true,
      reservePrice: true,
      startTime: true,
      endTime: true,
      extendedTime: true,
      watchersCount: true,
      videoStreamUrl: true,
      seller: {
        select: {
          userId: true,
        },
      },
      bids: { orderBy: { createdAt: "desc" }, take: 25 },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { sender: { select: { displayName: true } } },
      },
      streamSessions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}
