import "server-only";

import { prisma } from "@/lib/prisma";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import {
  deriveCanonicalSellerState,
  type CanonicalSellerReadiness,
  type SellerProfileStatusSnapshot,
} from "@/lib/seller-onboarding-state";
export {
  deriveCanonicalSellerState,
  getSellerCapabilityError,
  type CanonicalSellerReadiness,
  type CanonicalSellerState,
  type SellerCapability,
  type SellerProfileStatusSnapshot,
} from "@/lib/seller-onboarding-state";

export async function getCanonicalSellerReadiness(
  profile: SellerProfileStatusSnapshot | null,
): Promise<CanonicalSellerReadiness> {
  const stripeConfigured = stripeEnabled();
  let payoutsEnabled = Boolean(profile?.payoutsEnabled);

  if (profile?.stripeAccountId && stripeConfigured) {
    const stripe = getStripeClient();
    if (stripe) {
      try {
        const account = await stripe.accounts.retrieve(profile.stripeAccountId);
        payoutsEnabled = Boolean(account.payouts_enabled && account.charges_enabled);
        if (profile.payoutsEnabled !== payoutsEnabled) {
          await prisma.sellerProfile.update({
            where: { id: profile.id },
            data: { payoutsEnabled },
          });
          profile = {
            ...profile,
            payoutsEnabled,
          };
        }
      } catch (error) {
        console.error("Stripe seller status refresh failed", {
          error,
          sellerProfileId: profile.id,
          stripeAccountId: profile.stripeAccountId,
        });
      }
    }
  }

  return {
    hasSellerProfile: Boolean(profile),
    stripeConfigured,
    sellerState: deriveCanonicalSellerState(profile, payoutsEnabled),
    stripeAccountId: profile?.stripeAccountId ?? null,
    payoutsEnabled,
    sellerProfile: profile,
  };
}

export async function getCanonicalSellerReadinessForUser(userId: string) {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      status: true,
      stripeAccountId: true,
      payoutsEnabled: true,
    },
  });

  return getCanonicalSellerReadiness(profile);
}
