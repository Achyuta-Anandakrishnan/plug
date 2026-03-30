import type { SellerStatus } from "@prisma/client";

export type CanonicalSellerState =
  | "not_started"
  | "onboarding"
  | "restricted"
  | "payouts_disabled"
  | "active";

export type SellerCapability = "list" | "stream" | "receive_payouts";

export type SellerProfileStatusSnapshot = {
  id: string;
  userId: string;
  status: SellerStatus;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
};

export type CanonicalSellerReadiness = {
  hasSellerProfile: boolean;
  stripeConfigured: boolean;
  sellerState: CanonicalSellerState;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  sellerProfile: SellerProfileStatusSnapshot | null;
};

export function deriveCanonicalSellerState(
  profile: SellerProfileStatusSnapshot | null,
  payoutsEnabled: boolean,
): CanonicalSellerState {
  if (!profile) return "not_started";
  if (profile.status === "APPLIED" || profile.status === "IN_REVIEW") return "onboarding";
  if (profile.status === "REJECTED" || profile.status === "SUSPENDED") return "restricted";
  if (profile.status !== "APPROVED") return "restricted";
  if (!profile.stripeAccountId || !payoutsEnabled) return "payouts_disabled";
  return "active";
}

export function getSellerCapabilityError(
  readiness: CanonicalSellerReadiness,
  capability: SellerCapability,
) {
  if (readiness.sellerState === "active") return null;

  if (readiness.sellerState === "not_started") {
    return "Seller profile not found.";
  }

  if (readiness.sellerState === "onboarding") {
    return "Seller verification pending approval.";
  }

  if (readiness.sellerState === "restricted") {
    return "Seller account is restricted.";
  }

  if (!readiness.stripeConfigured) {
    return "Stripe payouts are not configured on this platform.";
  }

  if (capability === "receive_payouts") {
    return "Stripe payouts are not enabled for this seller.";
  }

  if (capability === "stream") {
    return "Connect Stripe payouts before starting a live selling room.";
  }

  return "Connect Stripe payouts from seller verification before creating listings.";
}
