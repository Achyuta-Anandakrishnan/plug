import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { jsonError, jsonOk } from "@/lib/api";
import { getCanonicalSellerReadiness } from "@/lib/seller-onboarding";
import { NextResponse } from "next/server";

const HTTP_ORIGIN_PATTERN = /^https?:\/\/[^/]+$/i;
const STRIPE_ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9]+$/;

function getSafeAppOrigin(request: Request) {
  try {
    const requestOrigin = new URL(request.url).origin.replace(/\/+$/g, "");
    if (HTTP_ORIGIN_PATTERN.test(requestOrigin)) {
      return requestOrigin;
    }
  } catch {
    // Fall through to secondary resolution.
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/g, "");
    if (HTTP_ORIGIN_PATTERN.test(forwardedOrigin)) {
      return forwardedOrigin;
    }
  }

  const headerOrigin = request.headers.get("origin")?.trim().replace(/\/+$/g, "");
  if (headerOrigin && HTTP_ORIGIN_PATTERN.test(headerOrigin)) {
    return headerOrigin;
  }

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin.replace(/\/+$/g, "");
      if (HTTP_ORIGIN_PATTERN.test(refererOrigin)) {
        return refererOrigin;
      }
    } catch {
      // Ignore malformed referers and continue fallback resolution.
    }
  }

  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/g, "");
  if (HTTP_ORIGIN_PATTERN.test(configuredOrigin)) {
    return configuredOrigin;
  }

  return "http://localhost:3000";
}

function buildSellerVerificationUrls(request: Request) {
  const origin = getSafeAppOrigin(request);
  const refreshUrl = new URL("/seller/verification", origin);
  refreshUrl.searchParams.set("stripe", "refresh");

  const returnUrl = new URL("/seller/verification", origin);
  returnUrl.searchParams.set("stripe", "success");

  return {
    origin,
    refreshUrl: refreshUrl.toString(),
    returnUrl: returnUrl.toString(),
  };
}

function normalizeStripeAccountId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return STRIPE_ACCOUNT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

async function createStripeOnboardingLink(request: Request, sessionUser: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) {
  const stripe = getStripeClient();
  if (!stripe) {
    return { ok: false as const, response: jsonError("Stripe is not configured.", 503) };
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sessionUser.id },
    select: { id: true, userId: true, status: true, stripeAccountId: true, payoutsEnabled: true },
  });

  if (!sellerProfile) {
    return { ok: false as const, response: jsonError("Seller profile required.", 403) };
  }

  let stripeAccountId = normalizeStripeAccountId(sellerProfile.stripeAccountId);

  if (sellerProfile.stripeAccountId && !stripeAccountId) {
    await prisma.sellerProfile.update({
      where: { id: sellerProfile.id },
      data: { stripeAccountId: null, payoutsEnabled: false },
    });
  }

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

  const { origin, refreshUrl, returnUrl } = buildSellerVerificationUrls(request);

  let link;
  try {
    link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
  } catch (error) {
    console.error("Stripe account link creation failed", {
      error,
      sellerProfileId: sellerProfile.id,
      stripeAccountId,
      origin,
      refreshUrl,
      returnUrl,
    });
    if (stripeAccountId && error instanceof Error && /expected pattern|no such account|invalid/i.test(error.message)) {
      const replacementAccount = await stripe.accounts.create({
        type: "express",
        email: sessionUser.email ?? undefined,
        metadata: {
          sellerProfileId: sellerProfile.id,
          userId: sessionUser.id,
        },
      });

      stripeAccountId = replacementAccount.id;

      await prisma.sellerProfile.update({
        where: { id: sellerProfile.id },
        data: {
          stripeAccountId,
          payoutsEnabled: false,
        },
      });

      try {
        link = await stripe.accountLinks.create({
          account: stripeAccountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
        });
      } catch (retryError) {
        console.error("Stripe account link creation retry failed", {
          error: retryError,
          sellerProfileId: sellerProfile.id,
          stripeAccountId,
          origin,
          refreshUrl,
          returnUrl,
        });
        const retryMessage = retryError instanceof Error && retryError.message.trim()
          ? retryError.message
          : "Unable to start Stripe onboarding.";
        return { ok: false as const, response: jsonError(retryMessage, 502) };
      }
    } else {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : "Unable to start Stripe onboarding.";
      return { ok: false as const, response: jsonError(message, 502) };
    }
  }

  const readiness = await getCanonicalSellerReadiness({
    ...sellerProfile,
    stripeAccountId,
  });

  return {
    ok: true as const,
    linkUrl: String(link.url).trim(),
    stripeAccountId,
    payoutsEnabled: readiness.payoutsEnabled,
    sellerState: readiness.sellerState,
  };
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("redirect") === "1") {
    const result = await createStripeOnboardingLink(request, sessionUser);
    if (!result.ok) {
      return result.response;
    }
    return NextResponse.redirect(result.linkUrl, { status: 302 });
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
  const result = await createStripeOnboardingLink(request, sessionUser);
  if (!result.ok) {
    return result.response;
  }

  return jsonOk({
    url: result.linkUrl,
    redirectPath: "/api/stripe/connect?redirect=1",
    stripeAccountId: result.stripeAccountId,
    payoutsEnabled: result.payoutsEnabled,
    sellerState: result.sellerState,
  });
}
