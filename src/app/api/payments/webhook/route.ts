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
        where: { providerPaymentIntent: intent.id, status: { not: "SUCCEEDED" } },
        data: { status: "SUCCEEDED" },
      });
      await prisma.order.updateMany({
        where: { payment: { providerPaymentIntent: intent.id }, status: { not: "PAID" } },
        data: { status: "PAID" },
      });
      const tradeSettlementId = intent.metadata?.tradeSettlementId;
      await prisma.tradeSettlement.updateMany({
        where: {
          ...(tradeSettlementId
            ? { id: tradeSettlementId }
            : { providerPaymentIntent: intent.id }),
          status: { not: "SUCCEEDED" },
        },
        data: {
          status: "SUCCEEDED",
          providerPaymentIntent: intent.id,
          providerChargeId:
            typeof intent.latest_charge === "string" ? intent.latest_charge : null,
          paidAt: new Date(),
        },
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      await prisma.payment.updateMany({
        where: { providerPaymentIntent: intent.id, status: { not: "FAILED" } },
        data: { status: "FAILED" },
      });
      const tradeSettlementId = intent.metadata?.tradeSettlementId;
      await prisma.tradeSettlement.updateMany({
        where: {
          ...(tradeSettlementId
            ? { id: tradeSettlementId }
            : { providerPaymentIntent: intent.id }),
          status: { not: "FAILED" },
        },
        data: {
          status: "FAILED",
          providerPaymentIntent: intent.id,
        },
      });
      break;
    }
    case "payment_intent.canceled": {
      const intent = event.data.object;
      const tradeSettlementId = intent.metadata?.tradeSettlementId;
      await prisma.tradeSettlement.updateMany({
        where: tradeSettlementId
          ? { id: tradeSettlementId }
          : { providerPaymentIntent: intent.id },
        data: {
          status: "CANCELED",
          providerPaymentIntent: intent.id,
        },
      });
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      const tradeSettlementId = session.metadata?.tradeSettlementId;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : null;
        await prisma.payment.updateMany({
          where: { orderId },
          data: {
            providerPaymentIntent: paymentIntentId,
            status: session.payment_status === "paid" ? "SUCCEEDED" : "PROCESSING",
          },
        });
        await prisma.order.updateMany({
          where: { id: orderId },
          data: { status: session.payment_status === "paid" ? "PAID" : "PENDING_PAYMENT" },
        });
      }

      if (tradeSettlementId) {
        await prisma.tradeSettlement.updateMany({
          where: { id: tradeSettlementId },
          data: {
            providerCheckoutSession: session.id,
            providerPaymentIntent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            status: session.payment_status === "paid" ? "SUCCEEDED" : "PROCESSING",
            paidAt: session.payment_status === "paid" ? new Date() : null,
          },
        });
      }
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
