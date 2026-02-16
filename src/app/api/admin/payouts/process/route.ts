import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return jsonError(admin.error, admin.status);
  }

  if (!stripeEnabled()) {
    return jsonError("Stripe not configured.", 400);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe client not available.", 500);
  }

  const now = new Date();
  const payouts = await prisma.payout.findMany({
    where: {
      status: "PENDING",
      providerTransferId: null,
      amount: { gt: 0 },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      order: {
        status: "CONFIRMED",
        seller: {
          payoutsEnabled: true,
          stripeAccountId: { not: null },
        },
      },
    },
    include: {
      order: {
        include: {
          seller: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const results: Array<{
    payoutId: string;
    orderId: string;
    ok: boolean;
    transferId?: string;
    error?: string;
  }> = [];

  for (const payout of payouts) {
    try {
      const destination = payout.order.seller.stripeAccountId;
      if (!destination) {
        results.push({
          payoutId: payout.id,
          orderId: payout.orderId,
          ok: false,
          error: "Missing seller Stripe account id.",
        });
        continue;
      }

      const transfer = await stripe.transfers.create(
        {
          amount: payout.amount,
          currency: payout.currency,
          destination,
          metadata: { orderId: payout.orderId, payoutId: payout.id },
        },
        {
          idempotencyKey: `payout_${payout.orderId}`,
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

      results.push({
        payoutId: payout.id,
        orderId: payout.orderId,
        ok: true,
        transferId: transfer.id,
      });
    } catch (error) {
      results.push({
        payoutId: payout.id,
        orderId: payout.orderId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return jsonOk({
    checked: payouts.length,
    processed: results.filter((r) => r.ok).length,
    results,
  });
}

