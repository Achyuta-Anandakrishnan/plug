import { prisma } from "@/lib/prisma";
import { getDevBuyerId, isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { computeExtendedEndTime } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { stripeEnabled } from "@/lib/stripe";

type CreateBidBody = {
  bidderId?: string;
  amount?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await parseJson<CreateBidBody>(request);
  if (!stripeEnabled()) {
    return jsonError("Stripe must be connected to place offers.", 503);
  }
  const sessionUser = await getSessionUser();
  const bidderId =
    sessionUser?.id ??
    (isDev() ? body?.bidderId || getDevBuyerId() : null);

  if (!bidderId || typeof body?.amount !== "number") {
    return jsonError("Authentication and amount are required.", 401);
  }
  if (!Number.isFinite(body.amount) || !Number.isInteger(body.amount) || body.amount <= 0) {
    return jsonError("amount must be a positive integer (cents).", 400);
  }

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { seller: true },
  });

  if (!auction) {
    return jsonError("Auction not found.", 404);
  }

  if (auction.listingType === "BUY_NOW") {
    return jsonError("Listing does not accept bids.", 409);
  }

  if (auction.status !== "LIVE") {
    return jsonError("Auction is not live.", 409);
  }

  const now = new Date();
  const effectiveEnd = auction.extendedTime ?? auction.endTime;
  if (effectiveEnd && effectiveEnd <= now) {
    return jsonError("Auction has ended.", 409);
  }

  if (body.amount < auction.currentBid + auction.minBidIncrement) {
    return jsonError(
      `Bid must be at least ${auction.minBidIncrement} higher than current bid.`,
      409,
    );
  }

  if (auction.seller.userId === bidderId) {
    return jsonError("Sellers cannot bid on their own listings.", 403);
  }

  const bidder = await prisma.user.findUnique({
    where: { id: bidderId },
  });

  if (!bidder) {
    return jsonError("Bidder not found.", 404);
  }

  const nextEndTime = computeExtendedEndTime(
    effectiveEnd,
    auction.antiSnipeSeconds,
    now,
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Optimistic concurrency: only advance the bid if currentBid hasn't changed.
      const updated = await tx.auction.updateMany({
        where: {
          id: auction.id,
          status: "LIVE",
          currentBid: auction.currentBid,
        },
        data: {
          currentBid: body.amount,
          extendedTime: nextEndTime,
        },
      });

      if (updated.count !== 1) {
        throw new Error("BID_CONFLICT");
      }

      const bid = await tx.bid.create({
        data: {
          auctionId: auction.id,
          bidderId: bidderId as string,
          amount: body.amount as number,
          extendsTimerBy: auction.antiSnipeSeconds,
        },
      });

      const updatedAuction = await tx.auction.findUnique({
        where: { id: auction.id },
      });

      return { bid, auction: updatedAuction };
    });

    return jsonOk(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BID_CONFLICT") {
      return jsonError("Bid out of date. Please refresh and try again.", 409);
    }
    throw error;
  }
}
