import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

const prisma = new PrismaClient();

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

const now = new Date();
const limit = Number(process.env.PAYOUT_BATCH_SIZE ?? "50");

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
  include: { order: { include: { seller: true } } },
  orderBy: { createdAt: "asc" },
  take: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50,
});

let ok = 0;
let failed = 0;

for (const payout of payouts) {
  const destination = payout.order.seller.stripeAccountId;
  if (!destination) {
    failed++;
    console.error(`Skipping payout ${payout.id}: missing destination`);
    continue;
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: payout.amount,
        currency: payout.currency,
        destination,
        metadata: { orderId: payout.orderId, payoutId: payout.id },
      },
      { idempotencyKey: `payout_${payout.orderId}` },
    );

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        providerTransferId: transfer.id,
        status: "PAID",
        paidAt: new Date(),
      },
    });

    ok++;
    console.log(`Paid payout ${payout.id} via transfer ${transfer.id}`);
  } catch (error) {
    failed++;
    console.error(`Failed payout ${payout.id}:`, error);
  }
}

console.log(`Done. Checked=${payouts.length} ok=${ok} failed=${failed}`);

await prisma.$disconnect();

