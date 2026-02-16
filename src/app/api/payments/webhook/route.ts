import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return jsonError("Stripe webhook not configured.", 400);
  }

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return jsonError("Missing Stripe signature.", 400);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return jsonError("Invalid signature.", 400);
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      await prisma.payment.updateMany({
        where: { providerPaymentIntent: intent.id },
        data: { status: "SUCCEEDED" },
      });
      await prisma.order.updateMany({
        where: { payment: { providerPaymentIntent: intent.id } },
        data: { status: "PAID" },
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      await prisma.payment.updateMany({
        where: { providerPaymentIntent: intent.id },
        data: { status: "FAILED" },
      });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      await prisma.payment.updateMany({
        where: { providerChargeId: charge.id },
        data: { status: "REFUNDED", refundedAt: new Date(charge.created * 1000) },
      });
      await prisma.order.updateMany({
        where: { payment: { providerChargeId: charge.id } },
        data: { status: "REFUNDED" },
      });
      break;
    }
    default:
      break;
  }

  return jsonOk({ received: true });
}
