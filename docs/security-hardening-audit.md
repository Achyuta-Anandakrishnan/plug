# Security Hardening Audit

## Fixed in this pass

### Admin routes
- Confirmed admin API routes are protected server-side through `requireAdmin(...)`.
- No admin API route in `src/app/api/admin` relies on client-only gating.

### Auth endpoints
- Added request throttling to native email-code login issue endpoint:
  - `/api/native/auth`
- Added request throttling to native email-code verification endpoint:
  - `/api/native/auth/verify`
- Added request throttling to resend verification email endpoint:
  - `/api/email/verification/send`

### Uploads and media validation
- Unified image-content validation through shared server helper:
  - `/src/lib/upload-validation.ts`
- Upload endpoints now:
  - validate by magic bytes, not just client MIME
  - derive extension from detected content type
  - use UUID-based storage paths only
  - keep file types restricted to PNG/JPEG/WEBP
- Added upload rate limits to:
  - `/api/uploads`
  - `/api/trades/uploads`
  - `/api/profile/avatar`

### Messaging and chat abuse
- Added rate limits for:
  - direct message sending
  - conversation creation
  - auction chat posting
- Direct message send now validates that attached message images belong to the sender's own `messages/<userId>/...` storage scope.
- Message and chat body lengths are now clamped server-side.
- Conversation creation now validates participant count and participant existence server-side.

### Seller/listing write paths
- Added server-side rate limiting to listing creation:
  - `/api/auctions`
- Existing bounty creation and trade-offer creation limits remain in place.

## Remaining risks

### Admin fallback by configured email
- `requireAdmin(...)` still accepts configured admin email addresses in addition to `role === "ADMIN"`.
- This preserves existing operational behavior, but it is weaker than role-only admin authorization.

### Public Supabase media URLs
- Uploaded media still uses public bucket URLs.
- Validation is stronger now, but message media is still publicly reachable if someone has the URL.

### In-memory rate limit fallback
- When Upstash is unavailable, rate limiting falls back to process memory.
- In multi-instance/serverless environments this is weaker than Redis-backed limiting.

### Message search/profile discovery
- Authenticated users can still search profiles for messaging.
- This appears intentional product behavior, but it remains an abuse surface for scraping unless additional business rules are added later.

## Recommended next steps

1. Remove configured-email admin fallback and rely on DB roles only.
2. Move sensitive/user-generated media to private buckets plus signed URLs where feasible.
3. Ensure Upstash-backed rate limiting is configured in production.
4. Add moderation and abuse review tooling for chat/message spam.
5. Consider per-IP plus per-user throttles on more write endpoints if traffic increases.
