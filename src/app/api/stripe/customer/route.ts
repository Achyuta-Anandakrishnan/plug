import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return jsonOk({ stripeConfigured: stripeEnabled(), hasPaymentMethod: false });
  }

  // Verify the customer still exists on Stripe (could be deleted or from a different mode)
  const stripe = getStripeClient();
  if (stripe) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if ((customer as { deleted?: boolean }).deleted) throw new Error("deleted");
    } catch {
      await prisma.user.update({ where: { id: sessionUser.id }, data: { stripeCustomerId: null } });
      return jsonOk({ stripeConfigured: stripeEnabled(), hasPaymentMethod: false });
    }
  }

  let hasPaymentMethod = false;
  if (stripe) {
    try {
      const methods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        limit: 1,
      });
      hasPaymentMethod = methods.data.length > 0;
    } catch {
      // If we can't verify, assume not set up
    }
  }

  return jsonOk({
    stripeConfigured: stripeEnabled(),
    hasPaymentMethod,
  });
}

export async function POST() {
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

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });

  if (!user) {
    return jsonError("User not found.", 404);
  }

  if (user.stripeCustomerId) {
    // Already registered — verify the customer still exists on Stripe
    try {
      await stripe.customers.retrieve(user.stripeCustomerId);
      const methods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        limit: 1,
      });
      return jsonOk({ hasPaymentMethod: methods.data.length > 0, stripeCustomerId: user.stripeCustomerId });
    } catch {
      // Customer was deleted on Stripe — fall through to recreate
    }
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return jsonOk({ hasPaymentMethod: true, stripeCustomerId: customer.id });
}
