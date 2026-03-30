import "server-only";
import { prisma } from "@/lib/prisma";
import { settleAuction } from "./settle-auction";

export async function expireAuctions(now = new Date()) {
  // Find auctions that need to be expired and settled
  const toSettle = await prisma.auction.findMany({
    where: {
      status: "LIVE",
      OR: [
        { extendedTime: { not: null, lte: now } },
        { extendedTime: null, endTime: { not: null, lte: now } },
      ],
    },
    select: { id: true },
  });

  // Settle each expired auction (this marks them ENDED internally)
  const settleResults = await Promise.allSettled(
    toSettle.map((a) => settleAuction(a.id)),
  );

  const settled = settleResults.filter((r) => r.status === "fulfilled").length;
  const settleErrors = settleResults.filter((r) => r.status === "rejected").length;

  if (settleErrors > 0) {
    console.error("Some auctions failed to settle during expiry", {
      errors: settleResults
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => r.reason),
    });
  }

  // End stream sessions tied to expired auctions
  const expiredSessions = await prisma.streamSession.updateMany({
    where: {
      status: "LIVE",
      OR: [
        { auction: { status: { in: ["ENDED", "CANCELED"] } } },
        {
          auction: {
            status: "LIVE",
            OR: [
              { extendedTime: { not: null, lte: now } },
              { extendedTime: null, endTime: { not: null, lte: now } },
            ],
          },
        },
      ],
    },
    data: { status: "ENDED" },
  });

  return {
    expiredAuctions: toSettle.length,
    settledAuctions: settled,
    settleErrors,
    expiredSessions: expiredSessions.count,
    runAt: now.toISOString(),
  };
}
