# Launch QA Matrix

## Current automated coverage

There was no existing automated test suite in the repo before this pass.

Small high-value unit coverage added:
- [tests/seller-onboarding.test.ts](/Users/achyu/Documents/plug/tests/seller-onboarding.test.ts)
  - canonical seller-state derivation
  - seller capability gating messages
- [tests/upload-validation.test.ts](/Users/achyu/Documents/plug/tests/upload-validation.test.ts)
  - image signature detection
  - scoped media ownership checks

## Current coverage summary by flow

| Flow | Automated coverage | Notes |
| --- | --- | --- |
| Sign up / login | Partial | Native auth rate limiting and verification logic are not integration-tested end to end |
| Seller onboarding | Partial | Canonical seller state is unit-tested |
| Create listing | None | Manual QA required |
| Buy now | None | Manual QA required |
| Bid | None | Manual QA required |
| Start live room | None | Manual QA required |
| Add stream inventory | None | Manual QA required |
| Trade post | None | Manual QA required |
| Trade offer | None | Manual QA required |
| Duel / settlement | None | Manual QA required |
| Bounty | None | Manual QA required |
| Messages | None | Manual QA required |
| Admin actions | None | Manual QA required |

## QA repeatability setup

Use the local seed utility before manual QA:

```bash
npm run qa:seed
```

Seed utility:
- [scripts/qa-seed.mjs](/Users/achyu/Documents/plug/scripts/qa-seed.mjs)

It creates or reuses:
- `qa-seller@dalow.local`
- `qa-buyer@dalow.local`
- Pokemon category
- one live listing
- one open trade post
- one open bounty
- one seed conversation

## Verification checklist

### 1. Sign up / login
- Sign up with a new email on [src/app/signup/page.tsx](/Users/achyu/Documents/plug/src/app/signup/page.tsx)
- Confirm duplicate signups are rejected
- Request a native login code on [src/app/signin/page.tsx](/Users/achyu/Documents/plug/src/app/signin/page.tsx)
- Verify the login code
- Confirm blocked/suspended accounts cannot sign in

Expected:
- account is created once
- verification / login flows return success states
- throttling appears after repeated abuse attempts

### 2. Seller onboarding
- Submit seller application on [src/app/seller/verification/page.tsx](/Users/achyu/Documents/plug/src/app/seller/verification/page.tsx)
- Approve/reject from [src/app/admin/sellers/page.tsx](/Users/achyu/Documents/plug/src/app/admin/sellers/page.tsx)
- Check Stripe status on [src/app/settings/payments/page.tsx](/Users/achyu/Documents/plug/src/app/settings/payments/page.tsx)

Expected:
- seller moves through canonical readiness states correctly
- non-approved sellers cannot list/stream
- approved-but-not-connected sellers are blocked until Stripe is ready

### 3. Create listing
- Open [src/app/sell/page.tsx](/Users/achyu/Documents/plug/src/app/sell/page.tsx)
- Verify seller gate behavior
- Verify cert lookup, image upload, and final listing creation

Expected:
- non-sellers blocked
- sellers without Stripe readiness blocked with correct message
- valid seller can create listing successfully

### 4. Buy now
- Open a live or listed auction detail on [src/app/auctions/[id]/page.tsx](/Users/achyu/Documents/plug/src/app/auctions/[id]/page.tsx)
- Use buy now checkout
- Confirm order is created once
- Leave a pending order and confirm stale order expiry behavior

Expected:
- checkout starts successfully
- duplicate stale order lock clears after expiry

### 5. Bid
- Place bids on a live listing
- Try invalid low bid
- Try rapid repeat bidding

Expected:
- low bids rejected
- valid bid accepted
- rate limiting applies on abuse

### 6. Start live room
- From a seller listing, start live on [src/app/api/streams/session/route.ts](/Users/achyu/Documents/plug/src/app/api/streams/session/route.ts) via UI
- Verify seller readiness gate
- Verify room token generation

Expected:
- only authorized seller/admin can host
- room only starts when seller is eligible

### 7. Add stream inventory
- In stream room, open inventory manager
- Add existing buy-now listing
- Add trade inventory
- Add another item after room is already live

Expected:
- inventory appears in stream queue
- unauthorized user cannot modify stream queue

### 8. Trade post
- Create new trade at [src/app/trades/new/page.tsx](/Users/achyu/Documents/plug/src/app/trades/new/page.tsx)
- Upload images
- Verify post appears in [src/app/trades/page.tsx](/Users/achyu/Documents/plug/src/app/trades/page.tsx)

Expected:
- invalid values rejected
- images upload successfully
- created post is visible and owned correctly

### 9. Trade offer
- Submit offer on another user’s trade
- Attempt duplicate active offer
- Attempt expired offer actions

Expected:
- duplicate active offer blocked
- expired offers cannot be accepted/countered
- cash-offer rules enforced

### 10. Duel / settlement
- Start duel from trade counter flow
- Confirm both-party approvals
- Complete duel
- Confirm settlement path updates trade correctly

Expected:
- duel room opens
- server resolves duel outcome
- trade settlement reflects final state

### 11. Bounty
- Create bounty on [src/app/bounties/new/page.tsx](/Users/achyu/Documents/plug/src/app/bounties/new/page.tsx)
- View bounty board on [src/app/bounties/page.tsx](/Users/achyu/Documents/plug/src/app/bounties/page.tsx)
- Comment on bounty
- Attempt invalid/oversized values

Expected:
- bounty create succeeds with valid inputs
- invalid money/text values rejected
- non-open bounty visibility follows intended restrictions

### 12. Messages
- Open [src/app/messages/page.tsx](/Users/achyu/Documents/plug/src/app/messages/page.tsx)
- Search profiles/conversations
- Start a new conversation
- Send text and image messages
- Spam-send until throttling triggers

Expected:
- one search surface returns both conversations and profiles
- only conversation feed scrolls
- only owned uploaded message images are accepted
- rate limiting triggers on abuse

### 13. Admin actions
- Review sellers in [src/app/admin/sellers/page.tsx](/Users/achyu/Documents/plug/src/app/admin/sellers/page.tsx)
- Update roles/statuses in [src/app/admin/profiles/page.tsx](/Users/achyu/Documents/plug/src/app/admin/profiles/page.tsx)
- Review waitlist at [src/app/admin/waitlist/page.tsx](/Users/achyu/Documents/plug/src/app/admin/waitlist/page.tsx)
- Trigger payout processor if applicable

Expected:
- admin-only routes are server-side protected
- profile/seller updates persist correctly
- waitlist data is visible only to admins

## Recommended QA order

1. Sign up / login
2. Seller onboarding
3. Create listing
4. Buy now
5. Bid
6. Start live room
7. Add stream inventory
8. Trade post
9. Trade offer
10. Duel / settlement
11. Bounty
12. Messages
13. Admin actions
