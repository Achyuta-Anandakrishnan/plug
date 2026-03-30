import test from "node:test";
import assert from "node:assert/strict";
import { deriveCanonicalSellerState, getSellerCapabilityError } from "../src/lib/seller-onboarding-state.ts";

const baseProfile = {
  id: "seller_1",
  userId: "user_1",
  stripeAccountId: null,
  payoutsEnabled: false,
} as const;

test("deriveCanonicalSellerState covers onboarding and active states", () => {
  assert.equal(
    deriveCanonicalSellerState({ ...baseProfile, status: "APPLIED" }, false),
    "onboarding",
  );
  assert.equal(
    deriveCanonicalSellerState({ ...baseProfile, status: "IN_REVIEW" }, false),
    "onboarding",
  );
  assert.equal(
    deriveCanonicalSellerState({ ...baseProfile, status: "APPROVED" }, false),
    "payouts_disabled",
  );
  assert.equal(
    deriveCanonicalSellerState(
      { ...baseProfile, status: "APPROVED", stripeAccountId: "acct_123", payoutsEnabled: true },
      true,
    ),
    "active",
  );
});

test("getSellerCapabilityError returns the correct gating message", () => {
  assert.equal(
    getSellerCapabilityError(
      {
        hasSellerProfile: false,
        stripeConfigured: true,
        sellerState: "not_started",
        stripeAccountId: null,
        payoutsEnabled: false,
        sellerProfile: null,
      },
      "list",
    ),
    "Seller profile not found.",
  );

  assert.equal(
    getSellerCapabilityError(
      {
        hasSellerProfile: true,
        stripeConfigured: true,
        sellerState: "payouts_disabled",
        stripeAccountId: "acct_123",
        payoutsEnabled: false,
        sellerProfile: { ...baseProfile, status: "APPROVED", stripeAccountId: "acct_123", payoutsEnabled: false },
      },
      "stream",
    ),
    "Connect Stripe payouts before starting a live selling room.",
  );

  assert.equal(
    getSellerCapabilityError(
      {
        hasSellerProfile: true,
        stripeConfigured: true,
        sellerState: "active",
        stripeAccountId: "acct_123",
        payoutsEnabled: true,
        sellerProfile: { ...baseProfile, status: "APPROVED", stripeAccountId: "acct_123", payoutsEnabled: true },
      },
      "receive_payouts",
    ),
    null,
  );
});
