# Seller Onboarding and Payout Gating Verification

This pass verified that seller onboarding and payout readiness are enforced through the canonical seller readiness model in `src/lib/seller-onboarding.ts`.

## Seller-gated routes and services checked

- `src/app/api/auctions/route.ts`
  - listing creation checks `getCanonicalSellerReadiness(...)` with `getSellerCapabilityError(..., "list")`
- `src/app/api/streams/session/route.ts`
  - stream session create/update checks `getSellerCapabilityError(..., "stream")`
- `src/app/api/streams/session/items/route.ts`
  - stream inventory attach/remove checks `getSellerCapabilityError(..., "stream")`
- `src/app/api/streams/token/route.ts`
  - host token issuance checks `getSellerCapabilityError(..., "stream")`
- `src/lib/server/settle-auction.ts`
  - Stripe transfer-data injection now uses canonical payout readiness via `getSellerCapabilityError(..., "receive_payouts")`
- `src/app/api/orders/[id]/confirm/route.ts`
  - auto-payout decision now uses canonical payout readiness via `getSellerCapabilityError(..., "receive_payouts")`
- `src/app/api/admin/payouts/process/route.ts`
  - payout processor now uses canonical payout readiness via `getSellerCapabilityError(..., "receive_payouts")`
- `src/app/api/admin/sellers/[id]/route.ts`
  - admin approval/rejection flow was reviewed for interaction with canonical state
- `src/app/api/auctions/[id]/buy/route.ts`
  - now blocks checkout if seller is not currently payout-eligible
- `src/app/api/auctions/[id]/bids/route.ts`
  - now blocks new bids if seller is not currently payout-eligible

## Inconsistencies fixed

- Seller payout transfer decisions were previously checking raw `sellerState === "active"` conditions inline.
  - Updated to use `getSellerCapabilityError(..., "receive_payouts")` in:
    - `src/lib/server/settle-auction.ts`
    - `src/app/api/orders/[id]/confirm/route.ts`
    - `src/app/api/admin/payouts/process/route.ts`
- Existing live listings could still accept new bids or buy-now checkouts after a seller lost payout eligibility.
  - Added canonical payout gating to:
    - `src/app/api/auctions/[id]/buy/route.ts`
    - `src/app/api/auctions/[id]/bids/route.ts`
- Seller UI still showed raw payout booleans in some places.
  - Updated seller-facing status messaging to rely on canonical `sellerState` in:
    - `src/components/sell/SellerListingQuickForm.tsx`
    - `src/app/settings/payments/page.tsx`
    - `src/app/seller/verification/page.tsx`

## Remaining risks

- `src/app/api/admin/sellers/[id]/route.ts` still mutates `sellerProfile.status` and `payoutsEnabled` directly as part of manual review. This is consistent with the canonical model today, but it still means admin review and Stripe readiness remain separate sources of input.
- Canonical readiness depends on live Stripe account refresh succeeding. If Stripe is temporarily unreachable, the app falls back to persisted seller profile payout flags until the next successful refresh.
- Existing listings owned by a seller who becomes restricted remain visible unless separately disabled; this pass only blocks new commerce actions against them.
