import { prisma } from "@/lib/prisma";
import { computeFees } from "@/lib/fees";
import { jsonError, jsonOk } from "@/lib/api";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import { getSessionUser } from "@/lib/auth";

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
      seller: {
        select: {
          id: true,
          userId: true,
          stripeAccountId: true,
          payoutsEnabled: true,
        },
      },
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

  // Auction must have passed its end time or already be ENDED
  const now = new Date();
  const effectiveEnd = auction.extendedTime ?? auction.endTime;
  if (auction.status !== "ENDED" && (!effectiveEnd || effectiveEnd > now)) {
    return jsonError("Auction has not ended yet.", 409);
  }

  // Guard against double-settlement
  const existingOrder = await prisma.order.findFirst({
    where: {
      auctionId: auction.id,
      status: { notIn: ["CANCELED", "REFUNDED"] },
    },
  });
  if (existingOrder) {
    return jsonError("Auction already settled.", 409);
  }

  // Find the winning bid (highest ACTIVE bid)
  const winningBid = await prisma.bid.findFirst({
    where: { auctionId: auction.id, status: "ACTIVE" },
    orderBy: { amount: "desc" },
  });

  if (!winningBid) {
    // No bids — just close the auction
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: "ENDED" },
    });
    return jsonOk({ settled: true, winner: null });
  }

  const { platformFee, processingFee } = computeFees(winningBid.amount);
  const chargeAmount = winningBid.amount + processingFee;

  let order!: {
    id: string;
    amount: number;
    status: string;
    currency: string;
    payment: { id: string; providerPaymentIntent: string | null } | null;
  };

  try {
    order = await prisma.$transaction(async (tx) => {
      // Mark winning bid
      await tx.bid.update({
        where: { id: winningBid.id },
        data: { status: "WON" },
      });

      // Mark all other active bids as outbid
      await tx.bid.updateMany({
        where: {
          auctionId: auction.id,
          status: "ACTIVE",
          id: { not: winningBid.id },
        },
        data: { status: "OUTBID" },
      });

      const created = await tx.order.create({
        data: {
          auctionId: auction.id,
          buyerId: winningBid.bidderId,
          sellerId: auction.sellerId,
          amount: winningBid.amount,
          platformFee,
          processingFee,
          currency: auction.currency,
          payment: {
            create: {
              provider: "STRIPE",
              amount: chargeAmount,
              currency: auction.currency,
            },
          },
        },
        include: { payment: { select: { id: true, providerPaymentIntent: true } } },
      });

      await tx.auction.update({
        where: { id: auction.id },
        data: { status: "ENDED" },
      });

      return created;
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002") {
      return jsonError("Auction already settled.", 409);
    }
    throw error;
  }

  // Create a Stripe Checkout session for the winner to pay
  let checkoutUrl: string | null = null;
  if (stripeEnabled()) {
    const stripe = getStripeClient();
    if (stripe) {
      try {
        const winner = await prisma.user.findUnique({
          where: { id: winningBid.bidderId },
          select: { email: true },
        });

        const origin = (() => {
          try {
            return new URL(request.url).origin;
          } catch {
            return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          }
        })();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

        const connectEnabled =
          Boolean(auction.seller.stripeAccountId) && auction.seller.payoutsEnabled;

        const checkoutSession = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            success_url: `${appUrl}/streams/${auction.id}?settle=success&order=${order.id}`,
            cancel_url: `${appUrl}/streams/${auction.id}?settle=cancel&order=${order.id}`,
            customer_email: winner?.email ?? undefined,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: auction.currency,
                  unit_amount: chargeAmount,
                  product_data: {
                    name: auction.title.slice(0, 120),
                    description: `Winning bid for auction ${auction.id}`.slice(0, 200),
                  },
                },
              },
            ],
            metadata: { orderId: order.id, auctionId: auction.id },
            payment_intent_data: {
              metadata: { orderId: order.id, auctionId: auction.id },
              ...(connectEnabled
                ? {
                    application_fee_amount: platformFee,
                    transfer_data: {
                      destination: auction.seller.stripeAccountId as string,
                    },
                  }
                : {}),
            },
          },
          { idempotencyKey: `settle_${order.id}` },
        );

        checkoutUrl = checkoutSession.url ?? null;

        await prisma.payment.update({
          where: { id: order.payment!.id },
          data: {
            providerPaymentIntent:
              typeof checkoutSession.payment_intent === "string"
                ? checkoutSession.payment_intent
                : null,
            status: "REQUIRES_CONFIRMATION",
          },
        });
      } catch (error) {
        // Order is created — log the Stripe failure but don't roll back
        console.error("Stripe Checkout create failed during auction settlement", {
          orderId: order.id,
          error,
        });
      }
    }
  }

  return jsonOk({
    settled: true,
    order: { id: order.id, amount: order.amount, status: order.status },
    winnerId: winningBid.bidderId,
    checkoutUrl,
  });
}
