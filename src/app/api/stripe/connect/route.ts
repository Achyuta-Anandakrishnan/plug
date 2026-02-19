import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe is not configured.", 503);
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sessionUser.id },
    select: { id: true, stripeAccountId: true, payoutsEnabled: true },
  });

  if (!sellerProfile) {
    return jsonError("Seller profile required.", 403);
  }

  let stripeAccountId = sellerProfile.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: sessionUser.email ?? undefined,
      metadata: {
        sellerProfileId: sellerProfile.id,
        userId: sessionUser.id,
      },
    });

    stripeAccountId = account.id;

    await prisma.sellerProfile.update({
      where: { id: sellerProfile.id },
      data: { stripeAccountId },
    });
  }

  const account = await stripe.accounts.retrieve(stripeAccountId);
  const payoutsEnabled = Boolean(account.payouts_enabled && account.charges_enabled);

  if (sellerProfile.payoutsEnabled !== payoutsEnabled) {
    await prisma.sellerProfile.update({
      where: { id: sellerProfile.id },
      data: { payoutsEnabled },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/seller/verification?stripe=refresh`,
    return_url: `${appUrl}/seller/verification?stripe=success`,
    type: "account_onboarding",
  });

  return jsonOk({
    url: link.url,
    stripeAccountId,
    payoutsEnabled,
  });
}
