import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleAuction } from "@/lib/server/settle-auction";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      seller: { select: { userId: true } },
    },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  const isAdmin = (sessionUser as { role?: string }).role === "ADMIN";
  const isSeller = auction.seller.userId === sessionUser.id;
  if (!isAdmin && !isSeller) {
    return jsonError("Forbidden.", 403);
  }

  if (auction.listingType === "BUY_NOW") {
    return jsonError("Buy-now listings cannot be settled as auctions.", 409);
  }

  if (auction.status === "CANCELED") {
    return jsonError("Auction has been canceled.", 409);
  }

  const now = new Date();
  const effectiveEnd = auction.extendedTime ?? auction.endTime;
  if (auction.status !== "ENDED" && (!effectiveEnd || effectiveEnd > now)) {
    return jsonError("Auction has not ended yet.", 409);
  }

  try {
    const appUrl = (() => {
      try { return new URL(request.url).origin; } catch { return undefined; }
    })();

    const result = await settleAuction(id, appUrl);

    if (result.error === "Auction already settled") {
      return jsonError("Auction already settled.", 409);
    }

    return jsonOk({
      settled: result.settled,
      orderId: result.orderId,
      winnerId: result.winner?.id ?? null,
      checkoutUrl: result.checkoutUrl,
    });
  } catch {
    return jsonError("Unable to settle auction.", 500);
  }
}
