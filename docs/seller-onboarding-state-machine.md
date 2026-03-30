# Seller Onboarding State Machine

This app now uses one canonical server-side seller readiness model in [src/lib/seller-onboarding.ts](/Users/achyu/Documents/plug/src/lib/seller-onboarding.ts).

## Canonical states

- `not_started`
  - no `SellerProfile` exists for the user
- `onboarding`
  - `SellerProfile.status` is `APPLIED` or `IN_REVIEW`
- `restricted`
  - `SellerProfile.status` is `REJECTED` or `SUSPENDED`
- `payouts_disabled`
  - seller is approved, but Stripe Connect is not attached or payouts are not enabled
- `active`
  - seller is approved and Stripe Connect payouts are enabled

## Inputs

The canonical state is derived from:

- `SellerProfile.status`
- `SellerProfile.stripeAccountId`
- `SellerProfile.payoutsEnabled`
- a live Stripe account refresh when Stripe is configured and an account id exists

## Capability enforcement

- `list`
  - requires canonical state `active`
- `stream`
  - requires canonical state `active`
- `receive_payouts`
  - requires canonical state `active`

## Routes using canonical enforcement

- [src/app/api/auctions/route.ts](/Users/achyu/Documents/plug/src/app/api/auctions/route.ts)
- [src/app/api/streams/session/route.ts](/Users/achyu/Documents/plug/src/app/api/streams/session/route.ts)
- [src/app/api/streams/session/items/route.ts](/Users/achyu/Documents/plug/src/app/api/streams/session/items/route.ts)
- [src/app/api/streams/token/route.ts](/Users/achyu/Documents/plug/src/app/api/streams/token/route.ts)
- [src/lib/server/settle-auction.ts](/Users/achyu/Documents/plug/src/lib/server/settle-auction.ts)
- [src/app/api/orders/[id]/confirm/route.ts](/Users/achyu/Documents/plug/src/app/api/orders/[id]/confirm/route.ts)
- [src/app/api/stripe/connect/route.ts](/Users/achyu/Documents/plug/src/app/api/stripe/connect/route.ts)

## Notes

- Admin approval no longer implies payout readiness.
- Stripe onboarding refresh is centralized through the canonical helper instead of being duplicated across route handlers.
