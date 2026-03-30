import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const { offerId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  if (!stripeEnabled()) {
    return jsonError("Stripe payments are not configured.", 503);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe client is unavailable.", 503);
  }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: {
      post: {
        select: {
          id: true,
          title: true,
        },
      },
      settlement: true,
    },
  });

  if (!offer) {
    return jsonError("Offer not found.", 404);
  }
  if (offer.status !== "ACCEPTED") {
    return jsonError("Offer must be accepted before payment can be completed.", 409);
  }
  if (!offer.settlement || offer.settlement.amount <= 0) {
    return jsonError("This offer does not require a cash settlement.", 409);
  }

  if (offer.settlement.payerId !== sessionUser.id) {
    return jsonError("Only the settlement payer can start checkout.", 403);
  }

  if (offer.settlement.status === "SUCCEEDED") {
    return jsonOk({
      paid: true,
      checkoutUrl: null,
      settlement: offer.settlement,
    });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXTAUTH_URL
    || "http://localhost:3000";

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: `${appUrl}/trades/${offer.post.id}?offer=${offer.id}&settlement=success`,
        cancel_url: `${appUrl}/trades/${offer.post.id}?offer=${offer.id}&settlement=cancel`,
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: offer.settlement.currency,
              unit_amount: offer.settlement.amount,
              product_data: {
                name: `Trade settlement - ${offer.post.title}`.slice(0, 120),
              },
            },
          },
        ],
        metadata: {
          tradeSettlementId: offer.settlement.id,
          tradeOfferId: offer.id,
          tradePostId: offer.post.id,
        },
        payment_intent_data: {
          metadata: {
            tradeSettlementId: offer.settlement.id,
            tradeOfferId: offer.id,
            tradePostId: offer.post.id,
          },
        },
      },
      { idempotencyKey: `trade_checkout_${offer.settlement.id}` },
    );
  } catch {
    return jsonError("Unable to create checkout session. Please try again.", 502);
  }

  // Only update DB status after Stripe session is confirmed created.
  const updatedSettlement = await prisma.tradeSettlement.update({
    where: { id: offer.settlement.id },
    data: {
      status: "PROCESSING",
      providerCheckoutSession: session.id,
      providerPaymentIntent: typeof session.payment_intent === "string"
        ? session.payment_intent
        : offer.settlement.providerPaymentIntent,
    },
  });

  return jsonOk({
    paid: false,
    checkoutUrl: session.url,
    settlement: updatedSettlement,
  });
}
