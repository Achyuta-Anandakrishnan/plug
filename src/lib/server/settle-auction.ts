import "server-only";
import { prisma } from "@/lib/prisma";
import { computeFees } from "@/lib/fees";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";

export type SettleAuctionResult = {
  auctionId: string;
  settled: boolean;
  winner: { id: string } | null;
  orderId: string | null;
  checkoutUrl: string | null;
  error?: string;
};

/**
 * Settles a single auction: finds the winning bid, creates an Order, fires a
 * Stripe Checkout session for the winner, and marks the auction ENDED.
 *
 * Safe to call on an already-ENDED auction — it will skip double-settlement.
 */
export async function settleAuction(auctionId: string, appUrl?: string): Promise<SettleAuctionResult> {
  const base: SettleAuctionResult = {
    auctionId,
    settled: false,
    winner: null,
    orderId: null,
    checkoutUrl: null,
  };

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
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

  if (!auction) return { ...base, error: "Auction not found" };
  if (auction.status === "CANCELED") return { ...base, error: "Auction canceled" };
  if (auction.listingType === "BUY_NOW") return { ...base, error: "Buy-now listing" };

  // Guard double-settlement
  const existingOrder = await prisma.order.findFirst({
    where: {
      auctionId: auction.id,
      status: { notIn: ["CANCELED", "REFUNDED"] },
    },
    select: { id: true },
  });

  if (existingOrder) {
    return { ...base, settled: true, orderId: existingOrder.id };
  }

  const winningBid = await prisma.bid.findFirst({
    where: { auctionId: auction.id, status: "ACTIVE" },
    orderBy: { amount: "desc" },
  });

  if (!winningBid) {
    // No bids — just mark ENDED
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: "ENDED" },
    });
    return { ...base, settled: true };
  }

  const { platformFee, processingFee } = computeFees(winningBid.amount);
  const chargeAmount = winningBid.amount + processingFee;

  let orderId: string;
  let paymentId: string | null = null;

  try {
    const order = await prisma.$transaction(async (tx) => {
      await tx.bid.update({ where: { id: winningBid.id }, data: { status: "WON" } });

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
        include: { payment: { select: { id: true } } },
      });

      await tx.auction.update({
        where: { id: auction.id },
        data: { status: "ENDED" },
      });

      return created;
    });

    orderId = order.id;
    paymentId = order.payment?.id ?? null;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002") {
      // Race condition — already settled
      const existing = await prisma.order.findFirst({
        where: { auctionId: auction.id },
        select: { id: true },
      });
      return { ...base, settled: true, orderId: existing?.id ?? null };
    }
    throw error;
  }

  // Create Stripe Checkout session
  let checkoutUrl: string | null = null;
  if (stripeEnabled()) {
    const stripe = getStripeClient();
    if (stripe) {
      try {
        const winner = await prisma.user.findUnique({
          where: { id: winningBid.bidderId },
          select: { email: true },
        });

        const resolvedAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const connectEnabled = Boolean(auction.seller.stripeAccountId) && auction.seller.payoutsEnabled;

        const checkoutSession = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            success_url: `${resolvedAppUrl}/streams/${auction.id}?settle=success&order=${orderId}`,
            cancel_url: `${resolvedAppUrl}/streams/${auction.id}?settle=cancel&order=${orderId}`,
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
            metadata: { orderId, auctionId: auction.id },
            payment_intent_data: {
              metadata: { orderId, auctionId: auction.id },
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
          { idempotencyKey: `settle_${orderId}` },
        );

        checkoutUrl = checkoutSession.url ?? null;

        if (paymentId) {
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              providerPaymentIntent:
                typeof checkoutSession.payment_intent === "string"
                  ? checkoutSession.payment_intent
                  : null,
              status: "REQUIRES_CONFIRMATION",
            },
          });
        }
      } catch (error) {
        console.error("Stripe Checkout create failed during settle", { auctionId, orderId, error });
      }
    }
  }

  return {
    auctionId,
    settled: true,
    winner: { id: winningBid.bidderId },
    orderId,
    checkoutUrl,
  };
}
