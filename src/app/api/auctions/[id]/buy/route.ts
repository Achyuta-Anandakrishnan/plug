import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeFees } from "@/lib/fees";
import { getDevBuyerId, isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import { getSessionUser } from "@/lib/auth";

type BuyNowBody = {
  buyerId?: string;
  paymentMethodId?: string;
  shippingAddress?: Record<string, unknown>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await parseJson<BuyNowBody>(request);
  if (!stripeEnabled()) {
    return jsonError("Stripe must be connected to buy now.", 503);
  }
  const sessionUser = await getSessionUser();
  const buyerId =
    sessionUser?.id ??
    (isDev() ? body?.buyerId || getDevBuyerId() : null);

  if (!buyerId) {
    return jsonError("Authentication required.", 401);
  }

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { seller: true },
  });

  if (!auction) {
    return jsonError("Listing not found.", 404);
  }

  if (auction.listingType === "AUCTION") {
    return jsonError("Listing does not support buy now.", 409);
  }

  if (auction.status !== "LIVE") {
    return jsonError("Listing is not live.", 409);
  }

  if (!auction.buyNowPrice) {
    return jsonError("Buy now price not available.", 409);
  }

  if (auction.seller.userId === buyerId) {
    return jsonError("Sellers cannot buy their own listings.", 403);
  }

  const now = new Date();
  const effectiveEnd = auction.extendedTime ?? auction.endTime;
  if (effectiveEnd && effectiveEnd <= now) {
    return jsonError("Listing has ended.", 409);
  }

  const existingOrder = await prisma.order.findFirst({
    where: {
      auctionId: auction.id,
      status: { notIn: ["CANCELED", "REFUNDED"] },
    },
  });

  if (existingOrder) {
    return jsonError("Order already created for this listing.", 409);
  }

  const { platformFee, processingFee } = computeFees(auction.buyNowPrice);
  const chargeAmount = auction.buyNowPrice + processingFee;

  let order;
  try {
    order = await prisma.order.create({
      data: {
        auctionId: auction.id,
        buyerId,
        sellerId: auction.sellerId,
        amount: auction.buyNowPrice,
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
        shipment: body?.shippingAddress
          ? {
              create: {
                address: body.shippingAddress as Prisma.InputJsonValue,
              },
            }
          : undefined,
      },
      include: { payment: true },
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002") {
      return jsonError("Order already created for this listing.", 409);
    }
    throw error;
  }

  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;
  const stripe = getStripeClient();
  if (stripe) {
    let intent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: chargeAmount,
          currency: auction.currency,
          capture_method: "automatic",
          metadata: {
            orderId: order.id,
            auctionId: auction.id,
          },
          payment_method: body?.paymentMethodId,
          confirm: Boolean(body?.paymentMethodId),
        },
        {
          // If the client retries, avoid creating multiple PaymentIntents for the same order.
          idempotencyKey: `pi_${order.id}`,
        },
      );
    } catch (error) {
      await prisma.payment.update({
        where: { id: order.payment?.id },
        data: { status: "FAILED" },
      });
      console.error("Stripe PaymentIntent create failed", error);
      return jsonError("Unable to initialize payment.", 502);
    }

    clientSecret = intent.client_secret ?? null;
    paymentIntentId = intent.id;

    const statusMap: Record<string, string> = {
      requires_payment_method: "REQUIRES_PAYMENT_METHOD",
      requires_confirmation: "REQUIRES_CONFIRMATION",
      requires_action: "REQUIRES_CONFIRMATION",
      processing: "PROCESSING",
      requires_capture: "PROCESSING",
      succeeded: "SUCCEEDED",
      canceled: "CANCELED",
    };

    await prisma.payment.update({
      where: { id: order.payment?.id },
      data: {
        providerPaymentIntent: intent.id,
        status: (statusMap[intent.status] ??
          "REQUIRES_CONFIRMATION") as
          | "REQUIRES_PAYMENT_METHOD"
          | "REQUIRES_CONFIRMATION"
          | "PROCESSING"
          | "SUCCEEDED"
          | "FAILED"
          | "CANCELED",
      },
    });
  }

  return jsonOk({
    order,
    paymentIntentId,
    clientSecret,
  });
}
