import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { jsonError, jsonOk } from "@/lib/api";
import { getCanonicalSellerReadiness } from "@/lib/seller-onboarding";

const HTTP_ORIGIN_PATTERN = /^https?:\/\/[^/]+$/i;

function getSafeAppOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/g, "");
    if (HTTP_ORIGIN_PATTERN.test(forwardedOrigin)) {
      return forwardedOrigin;
    }
  }

  try {
    const requestOrigin = new URL(request.url).origin.replace(/\/+$/g, "");
    if (HTTP_ORIGIN_PATTERN.test(requestOrigin)) {
      return requestOrigin;
    }
  } catch {
    // Fall through to configured env origin.
  }

  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/g, "");
  if (HTTP_ORIGIN_PATTERN.test(configuredOrigin)) {
    return configuredOrigin;
  }

  return "http://localhost:3000";
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const stripe = getStripeClient();
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sessionUser.id },
    select: { id: true, userId: true, stripeAccountId: true, payoutsEnabled: true, status: true },
  });

  if (!sellerProfile) {
    return jsonOk({
      hasSellerProfile: false,
      stripeConfigured: Boolean(stripe),
      stripeAccountId: null,
      payoutsEnabled: false,
      sellerStatus: null,
      sellerState: "not_started",
    });
  }

  const readiness = await getCanonicalSellerReadiness(sellerProfile);

  return jsonOk({
    hasSellerProfile: true,
    stripeConfigured: Boolean(stripe),
    stripeAccountId: readiness.stripeAccountId,
    payoutsEnabled: readiness.payoutsEnabled,
    sellerStatus: sellerProfile.status,
    sellerState: readiness.sellerState,
  });
}

export async function POST(request: Request) {
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
    select: { id: true, userId: true, status: true, stripeAccountId: true, payoutsEnabled: true },
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

  const appOrigin = getSafeAppOrigin(request);

  let link;
  try {
    link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appOrigin}/seller/verification?stripe=refresh`,
      return_url: `${appOrigin}/seller/verification?stripe=success`,
      type: "account_onboarding",
    });
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : "Unable to start Stripe onboarding.";
    return jsonError(message, 502);
  }

  const readiness = await getCanonicalSellerReadiness({
    ...sellerProfile,
    stripeAccountId,
  });

  return jsonOk({
    url: link.url,
    stripeAccountId,
    payoutsEnabled: readiness.payoutsEnabled,
    sellerState: readiness.sellerState,
  });
}
