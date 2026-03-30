# Schema Shim Cleanup Summary

This pass removed all request-time calls to the no-op compatibility shims:

- `ensureTradeSchema()`
- `ensureBountySchema()`
- `ensureStreamSchema()`
- `ensureConversationSchema()`
- `ensureWaitlistSchema()`
- `ensureProfileSchema()`

## No-op ensure calls removed from

### Trades
- `src/app/api/trades/route.ts`
- `src/app/api/trades/[id]/route.ts`
- `src/app/api/trades/[id]/offers/route.ts`
- `src/app/api/trades/offers/[offerId]/route.ts`
- `src/app/api/trades/offers/[offerId]/checkout/route.ts`
- `src/app/api/trades/offers/[offerId]/duel/route.ts`

### Bounties
- `src/app/api/bounties/route.ts`
- `src/app/api/bounties/[id]/route.ts`
- `src/app/api/bounties/[id]/comments/route.ts`
- `src/app/api/bounties/search/route.ts`
- `src/app/bounties/[id]/page.tsx`

### Streams
- `src/app/api/streams/session/route.ts`
- `src/app/api/streams/session/items/route.ts`

### Conversations
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`

### Waitlist
- `src/app/api/waitlist/route.ts`
- `src/app/api/admin/waitlist/route.ts`

### Profile / account surfaces
- `src/lib/auth.ts`
- `src/app/u/[username]/page.tsx`
- `src/app/profiles/[id]/page.tsx`
- `src/app/api/native/auth/route.ts`
- `src/app/api/native/auth/google/callback/route.ts`
- `src/app/api/admin/profiles/route.ts`
- `src/app/api/admin/profiles/[id]/route.ts`
- `src/app/api/profile/avatar/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/forum/posts/route.ts`
- `src/app/api/forum/posts/[id]/route.ts`
- `src/app/api/forum/posts/[id]/comments/route.ts`

## Shared helper introduced

- `src/lib/schema-missing.ts`

This now holds the shared `isSchemaMissingError(error, patterns)` matcher.

## Feature-specific schema-missing detectors still remaining

These are still used to preserve the existing beta-safe fallback behavior:

- `isTradeSchemaMissing()` in:
  - `src/app/api/trades/route.ts`
  - `src/app/api/trades/[id]/offers/route.ts`
- `isBountySchemaMissing()` in:
  - `src/app/api/bounties/route.ts`
  - `src/app/api/bounties/[id]/route.ts`
  - `src/app/api/bounties/[id]/comments/route.ts`
  - `src/app/api/bounties/search/route.ts`
  - `src/app/bounties/[id]/page.tsx`
- `isStreamSchemaMissing()` in:
  - `src/app/api/streams/session/items/route.ts`
- `isConversationSchemaMissing()` in:
  - `src/app/api/conversations/route.ts`
  - `src/app/api/conversations/[id]/messages/route.ts`
- `isWaitlistSchemaMissing()` in:
  - `src/app/api/waitlist/route.ts`
- `isProfileSchemaMissing()` in:
  - `src/app/api/forum/posts/route.ts`
  - `src/app/api/forum/posts/[id]/route.ts`
  - `src/app/api/forum/posts/[id]/comments/route.ts`

## Helper files that can be deleted in a later pass

These files are now down to a detector wrapper plus a dead `ensure*Schema()` shim, so they can be deleted after their call sites are switched to import `isSchemaMissingError(...)` directly:

- `src/lib/trade-schema.ts`
- `src/lib/bounty-schema.ts`
- `src/lib/stream-schema.ts`
- `src/lib/conversation-schema.ts`
- `src/lib/waitlist-schema.ts`

`src/lib/profile-schema.ts` is not ready to delete yet in this pass because forum routes still use `isProfileSchemaMissing()` directly and it was intentionally left last/safer.
