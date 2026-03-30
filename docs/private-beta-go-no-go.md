# Private Beta Go / No-Go

Date: 2026-03-30

## Required Checks

- Auth
  - new signup works
  - native login code issue/verify works
  - duplicate signup is rejected
  - throttling triggers on repeated signup/login abuse
- Seller onboarding
  - onboarding seller cannot list or stream
  - approved but payouts-disabled seller is blocked with the correct message
  - payout-ready seller can list and start live
- Listings / commerce
  - create listing succeeds for payout-ready seller
  - buy now creates one order only
  - stale order expiry behaves correctly
  - valid bids succeed and invalid bids fail
- Live
  - stream session starts for payout-ready seller
  - stream inventory can be preloaded and added while live
  - host token issuance works for host, not for unauthorized user
- Trades
  - trade post create succeeds
  - trade offer create succeeds
  - duplicate active offer is rejected
  - expired offer actions are rejected
- Duel / settlement
  - duel start/approval path works
  - settlement updates final trade state correctly
- Bounty
  - bounty create succeeds
  - bounty detail loads
  - bounty comment create succeeds
- Messages
  - conversation search returns conversations and profiles
  - new conversation starts cleanly
  - text and image messages send
  - only chat/feed panes scroll
- Admin
  - seller review routes work
  - profile role/status updates persist
  - waitlist data is visible to admins only

## Optional Checks

- mobile-specific shell QA on all top-level pages
- JustTCG enrichment / pop-spec display fallback behavior
- forum create/edit/comment flows
- referral flow
- native iOS shell smoke pass

## Top 5 Beta-Risk Routes

1. [src/app/api/auctions/[id]/buy/route.ts](/Users/achyu/Documents/plug/src/app/api/auctions/[id]/buy/route.ts)
   - High risk because it depends on order dedupe, stale-order expiry, Stripe setup, and seller gating all at once.
2. [src/app/api/payments/webhook/route.ts](/Users/achyu/Documents/plug/src/app/api/payments/webhook/route.ts)
   - High risk because late or replayed payment events can corrupt order state if not handled consistently.
3. [src/app/api/streams/session/route.ts](/Users/achyu/Documents/plug/src/app/api/streams/session/route.ts)
   - High risk because it combines seller readiness, auction ownership, and live-provider setup.
4. [src/app/api/trades/[id]/offers/route.ts](/Users/achyu/Documents/plug/src/app/api/trades/[id]/offers/route.ts)
   - High risk because it is stateful, heavily validated, and closely coupled to later duel/settlement flows.
5. [src/app/api/conversations/[id]/messages/route.ts](/Users/achyu/Documents/plug/src/app/api/conversations/[id]/messages/route.ts)
   - High risk because it is a hot write path with abuse throttling, ownership checks, and media attachment validation.

## Blockers

- Any required flow above failing in a way that prevents a user from completing the core commerce loop
- Seller gating incorrectly allowing or blocking listing / live actions
- Payment/order state inconsistencies between buy-now, webhook, and confirm flows
- Stream session creation or host token issuance failing for payout-ready sellers
- Message send failures for normal text/image usage

## Acceptable-For-Beta Risks

- limited automated coverage outside the small unit tests and manual QA matrix
- optional flows not fully exercised if the required commerce loop is clean
- admin configured-email fallback remaining in place for a tightly controlled private beta
- public media URLs remaining in use for beta if uploads and ownership checks are otherwise stable

## Suggested Go / No-Go Rule

- `Go` if all required checks pass once with seeded accounts and once with at least one fresh user path
- `No-Go` if any blocker above reproduces consistently or if payment/live seller gating remains ambiguous during QA
