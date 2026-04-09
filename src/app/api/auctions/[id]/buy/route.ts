import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeFees } from "@/lib/fees";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import { getSessionUser } from "@/lib/auth";
import { getCanonicalSellerReadiness, getSellerCapabilityError } from "@/lib/seller-onboarding";

type BuyNowBody = {
  paymentMethodId?: string;
  shippingAddress?: Record<string, unknown>;
};

const ORDER_EXPIRY_MS = 30 * 1000;

function isExpiredPendingOrder(order: { status: string; createdAt: Date }) {
  return order.status === "PENDING_PAYMENT" && (Date.now() - order.createdAt.getTime()) >= ORDER_EXPIRY_MS;
}

async function expireStaleOrder(order: {
  id: string;
  status: string;
  createdAt: Date;
  payment: {
    id: string;
    providerPaymentIntent: string | null;
    status: string;
  } | null;
}) {
  if (!isExpiredPendingOrder(order)) return false;

  const stripe = getStripeClient();
  const paymentIntentId = order.payment?.providerPaymentIntent;
  if (stripe && paymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      console.error("Failed to cancel expired payment intent", {
        orderId: order.id,
        paymentIntentId,
        error,
      });
    }
  }

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        orderId: order.id,
        status: { notIn: ["SUCCEEDED", "REFUNDED", "CANCELED"] },
      },
      data: {
        status: "CANCELED",
      },
    }),
    prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING_PAYMENT",
      },
      data: {
        status: "CANCELED",
      },
    }),
  ]);

  return true;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await parseJson<BuyNowBody>(request);
  if (!stripeEnabled()) {
    return jsonError("Payments are unavailable right now.", 503);
  }
  const sessionUser = await getSessionUser();
  const buyerId = sessionUser?.id ?? null;

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

  const sellerReadiness = await getCanonicalSellerReadiness({
    id: auction.seller.id,
    userId: auction.seller.userId,
    status: auction.seller.status,
    stripeAccountId: auction.seller.stripeAccountId,
    payoutsEnabled: auction.seller.payoutsEnabled,
  });
  const payoutGateError = getSellerCapabilityError(sellerReadiness, "receive_payouts");
  if (payoutGateError) {
    return jsonError("Seller payouts are not available for this listing right now.", 409);
  }
  const connectEnabled = !payoutGateError && Boolean(sellerReadiness.stripeAccountId);

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
    include: {
      payment: {
        select: {
          id: true,
          providerPaymentIntent: true,
          status: true,
        },
      },
    },
  });

  if (existingOrder) {
    if (await expireStaleOrder(existingOrder)) {
      // Stale checkout was canceled. Continue and create a fresh order below.
    } else {
      return jsonError("Order already created for this listing.", 409);
    }
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
  let checkoutUrl: string | null = null;
  const stripe = getStripeClient();
  if (stripe) {
    if (body?.paymentMethodId) {
      let intent;
      try {
        intent = await stripe.paymentIntents.create(
          {
            amount: chargeAmount,
            currency: auction.currency ?? "usd",
            capture_method: "automatic",
            metadata: {
              orderId: order.id,
              auctionId: auction.id,
            },
            payment_method: body.paymentMethodId,
            confirm: true,
            ...(connectEnabled
              ? {
                  application_fee_amount: platformFee,
                  transfer_data: { destination: sellerReadiness.stripeAccountId as string },
                }
              : {}),
          },
          {
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
    } else {
      try {
        const origin = (() => {
          try {
            const o = new URL(request.url).origin;
            // Stripe requires HTTPS for non-localhost URLs
            if (!o.startsWith("http://localhost") && !o.startsWith("http://127.0.0.1")) {
              return o.replace(/^http:\/\//, "https://");
            }
            return o;
          } catch {
            return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          }
        })();
        const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
        const appUrl = (!rawAppUrl.startsWith("http://localhost") && !rawAppUrl.startsWith("http://127.0.0.1"))
          ? rawAppUrl.replace(/^http:\/\//, "https://")
          : rawAppUrl;

        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            success_url: `${appUrl}/streams/${auction.id}?buy=success&order=${order.id}`,
            cancel_url: `${appUrl}/streams/${auction.id}?buy=cancel&order=${order.id}`,
            customer_email: sessionUser?.email ?? undefined,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: auction.currency ?? "usd",
                  unit_amount: chargeAmount,
                  product_data: {
                    name: auction.title.slice(0, 120),
                    description: `Buy now checkout for listing ${auction.id}`.slice(0, 200),
                  },
                },
              },
            ],
            metadata: {
              orderId: order.id,
              auctionId: auction.id,
            },
            payment_intent_data: {
              metadata: {
                orderId: order.id,
                auctionId: auction.id,
              },
              ...(connectEnabled
                ? {
                    application_fee_amount: platformFee,
                    transfer_data: { destination: sellerReadiness.stripeAccountId as string },
                  }
                : {}),
            },
          },
          {
            idempotencyKey: `cs_${order.id}`,
          },
        );

        checkoutUrl = session.url ?? null;
        paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
        await prisma.payment.update({
          where: { id: order.payment?.id },
          data: {
            providerPaymentIntent: paymentIntentId,
            status: "REQUIRES_CONFIRMATION",
          },
        });
      } catch (error) {
        await prisma.payment.update({
          where: { id: order.payment?.id },
          data: { status: "FAILED" },
        });
        console.error("Stripe Checkout session create failed", error);
        return jsonError("Unable to initialize checkout.", 502);
      }
    }
  }

  return jsonOk({
    order,
    paymentIntentId,
    clientSecret,
    checkoutUrl,
  });
}
