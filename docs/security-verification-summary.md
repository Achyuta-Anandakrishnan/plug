# Security Verification Summary

Date: 2026-03-30

## Verified Safe Areas

- Admin API routes under `src/app/api/admin/**` are protected server-side through `requireAdmin(...)`.
- Conversation/message ownership is enforced server-side:
  - conversation search/read requires an authenticated participant
  - message read/write requires an authenticated participant
- Upload endpoints validate image content using magic-byte detection instead of trusting the filename alone.
- Core write-path throttles exist for:
  - native auth code issue / verify
  - email verification resend
  - listing creation
  - trade post creation
  - trade offer creation
  - bounty creation
  - conversation creation
  - direct-message send
  - auction chat send
  - uploads

## Fixes Made In This Pass

- Tightened generic upload scope handling in [src/app/api/uploads/route.ts](/Users/achyu/Documents/plug/src/app/api/uploads/route.ts)
  - unknown `scope` values are now rejected
  - request-time storage paths now map only to explicitly allowed scopes
- Tightened auction chat writes in [src/app/api/auctions/[id]/chat/route.ts](/Users/achyu/Documents/plug/src/app/api/auctions/[id]/chat/route.ts)
  - chat messages can now only be posted while the auction/stream is actually `LIVE`
- Tightened signup abuse control in [src/app/api/signup/route.ts](/Users/achyu/Documents/plug/src/app/api/signup/route.ts)
  - signup is now throttled by normalized email as well as IP

## Remaining Risks

- Admin access still allows a configured-email fallback in `requireAdmin(...)` via [src/lib/admin.ts](/Users/achyu/Documents/plug/src/lib/admin.ts)
  - this is server-side, but it is still broader than pure role-based admin authorization
- Public Supabase URLs are still used for uploaded media
  - ownership is checked at attach/send time for messages, but the media itself is not private once uploaded
- Read-heavy polling surfaces still exist
  - not a direct auth bypass, but still an abuse/stability risk under load if external rate limiting is absent
- Rate limiting still depends on the backing limiter configuration
  - if shared external rate limiting is not configured, behavior is weaker than intended in a multi-instance deployment

## Private Beta Acceptability

### Acceptable For Private Beta

- Current admin route server-side protection, assuming admin emails are tightly controlled by operators
- Current upload validation and scope checks
- Current direct-message and auction-chat abuse throttles
- Current listing / trade / bounty creation throttles

### Not Acceptable For Wider Launch Without Another Pass

- Keeping configured-email admin fallback as a long-term authorization path
- Keeping uploaded media fully public for user-generated message content
- Relying on non-shared or partially configured rate limiting in a scaled deployment

## Recommended Next Steps

1. Move admin authorization to role-only enforcement in production.
2. Decide whether message media should move to signed/private delivery.
3. Treat shared external rate limiting as required, not optional, before broader launch.
