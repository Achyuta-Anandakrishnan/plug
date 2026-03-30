# Runtime Schema Audit

Prisma migrations are now the only source of truth for schema changes. Request-time schema repair helpers remain only as compatibility shims and must not mutate the database.

## Runtime schema helpers audited

| Helper | Runtime mutation before this change | Schema objects touched | Still needed at request time? | Migration coverage |
| --- | --- | --- | --- | --- |
| `src/lib/trade-schema.ts` | Yes | `TradeOffer`, `TradeOfferCard`, `TradeSettlement`, `TradeDuel`, related enums, indexes, foreign keys, later `TradeOffer` game columns | No | Covered by `20260309173500_trades_feature`, `20260309193000_trade_settlements`, `20260310231500_trade_game_consent`, `20260317183000_social_and_verification_foundation`, `20260323221500_trade_duels` |
| `src/lib/bounty-schema.ts` | Yes | `WantRequestStatus`, `WantRequest`, `WantRequestComment`, `UserSave.wantRequestId`, indexes, foreign keys | No | Covered by `20260317183000_social_and_verification_foundation`, `20260323163000_want_board`, `20260323194000_bounty_fields`, `20260325210000_bounty_comments` |
| `src/lib/stream-schema.ts` | Yes | `StreamSessionItem`, indexes, foreign key | No | Covered by `20260329143000_stream_session_items` |
| `src/lib/conversation-schema.ts` | Yes | `DirectMessage.imageUrl` | No | Covered by `20260325235000_direct_message_images` |
| `src/lib/waitlist-schema.ts` | Yes | `WaitlistEntry`, indexes | No | Covered by `20260329113000_waitlist_entries` |
| `src/lib/profile-schema.ts` | Yes | `User.accountStatus` | No | Covered by `20260327153000_admin_account_status` |
| `src/lib/forum-schema.ts` | No-op | None | No | Already no-op |
| `src/lib/verify-card-schema.ts` | No-op | None | No | Already no-op |

## Request-time call sites

The following areas still import compatibility helpers, but the helpers are now inert:

- Trade routes and duel routes
- Bounty routes and bounty detail page
- Stream session routes
- Conversation/message routes
- Waitlist routes
- Auth/profile/user/admin profile routes and profile pages

These call sites are no longer schema dependencies. They can be removed later as cleanup, but they no longer mutate or repair schema during requests.

## Migration gaps found and fixed

The audit found one schema object present in `prisma/schema.prisma` without migration coverage:

- `NativeLoginCode`

That object now has migration coverage in:

- `prisma/migrations/20260330173000_native_login_codes/migration.sql`

## Fresh database expectation

A fresh database should be created from Prisma migrations only via:

- `prisma migrate deploy`

No request path should be responsible for creating or altering tables, columns, indexes, enums, or foreign keys.
