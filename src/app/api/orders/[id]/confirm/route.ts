import { prisma } from "@/lib/prisma";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/api";
import { getStripeClient } from "@/lib/stripe";
import { getSessionUser } from "@/lib/auth";
import { getCanonicalSellerReadiness, getSellerCapabilityError } from "@/lib/seller-onboarding";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sessionUser = await getSessionUser();
  const buyerId = sessionUser?.id ?? null;
  if (!buyerId) {
    return jsonError("Authentication required.", 401);
  }

  if (!(await checkRateLimit(`confirm-order:${id}`, 5, 60_000))) {
    return jsonError("Too many confirmation attempts. Try again shortly.", 429);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seller: true, payout: true },
  });

  if (!order) {
    return jsonError("Order not found.", 404);
  }

  if (order.buyerId !== buyerId) {
    return jsonError("Not authorized to confirm this order.", 403);
  }

  if (order.status === "CONFIRMED") {
    return jsonOk(order);
  }

  if (order.status !== "DELIVERED" && order.status !== "PAID") {
    return jsonError("Order not ready for confirmation.", 409);
  }

  const sellerNet = Math.max(order.amount - order.platformFee, 0);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMED" },
  });

  // Ensure we don't double-pay on retries.
  const existingPayout = order.payout;
  if (existingPayout?.status === "PAID" || existingPayout?.providerTransferId) {
    return jsonOk(updated);
  }

  const scheduledAt = new Date(
    Date.now() + Math.max(order.seller.payoutHoldDays ?? 0, 0) * 24 * 60 * 60 * 1000,
  );

  const payout =
    existingPayout ??
    (await prisma.payout.create({
      data: {
        orderId: order.id,
        provider: "STRIPE",
        amount: sellerNet,
        currency: order.currency,
        status: "PENDING",
        scheduledAt,
      },
    }));

  const stripe = getStripeClient();
  const sellerReadiness = await getCanonicalSellerReadiness({
    id: order.seller.id,
    userId: order.seller.userId,
    status: order.seller.status,
    stripeAccountId: order.seller.stripeAccountId,
    payoutsEnabled: order.seller.payoutsEnabled,
  });
  const payoutGateError = getSellerCapabilityError(sellerReadiness, "receive_payouts");
  const canAutoPay =
    Boolean(stripe) &&
    !payoutGateError &&
    Boolean(sellerReadiness.stripeAccountId) &&
    scheduledAt <= new Date() &&
    sellerNet > 0;

  if (canAutoPay) {
    try {
      const transfer = await stripe!.transfers.create(
        {
          amount: sellerNet,
          currency: order.currency,
          destination: sellerReadiness.stripeAccountId as string,
          metadata: { orderId: order.id },
        },
        {
          // Prevent duplicate transfers if this endpoint is retried.
          idempotencyKey: `payout_${order.id}`,
        },
      );

      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          providerTransferId: transfer.id,
          status: "PAID",
          paidAt: new Date(),
        },
      });
    } catch (error) {
      // Leave payout pending for later retry/ops intervention.
      console.error("Stripe transfer failed", error);
    }
  }

  return jsonOk(updated);
}
