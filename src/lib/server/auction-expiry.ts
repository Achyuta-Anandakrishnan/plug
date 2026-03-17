import "server-only";
import { prisma } from "@/lib/prisma";

export async function expireAuctions(now = new Date()) {
  const [expiredAuctions, expiredSessions] = await prisma.$transaction([
    prisma.auction.updateMany({
      where: {
        status: "LIVE",
        OR: [
          { extendedTime: { not: null, lte: now } },
          { extendedTime: null, endTime: { not: null, lte: now } },
        ],
      },
      data: { status: "ENDED" },
    }),
    prisma.streamSession.updateMany({
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
    }),
  ]);

  return {
    expiredAuctions: expiredAuctions.count,
    expiredSessions: expiredSessions.count,
    runAt: now.toISOString(),
  };
}
