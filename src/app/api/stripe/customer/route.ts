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

  let customerId = user.stripeCustomerId;

  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if (!(existing as { deleted?: boolean }).deleted) {
        const methods = await stripe.paymentMethods.list({ customer: customerId, limit: 1 });
        if (methods.data.length > 0) {
          return jsonOk({ hasPaymentMethod: true, stripeCustomerId: customerId });
        }
      }
    } catch {
      // Customer deleted on Stripe — recreate below
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: null } });
      customerId = null;
    }
  }

  if (!customerId) {
    const newCustomer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: newCustomer.id } });
    customerId = newCustomer.id;
  }

  const rawAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const appUrl = (!rawAppUrl.startsWith("http://localhost") && !rawAppUrl.startsWith("http://127.0.0.1"))
    ? rawAppUrl.replace(/^http:\/\//, "https://")
    : rawAppUrl;

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      success_url: `${appUrl}/settings/payments?setup=success`,
      cancel_url: `${appUrl}/settings/payments?setup=cancel`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unable to create payment setup session.";
    return jsonError(msg, 502);
  }

  return jsonOk({ setupUrl: session.url });
}
