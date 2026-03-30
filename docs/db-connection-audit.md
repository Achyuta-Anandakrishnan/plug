# Database Connection Audit

## Shared Prisma client

- App runtime uses a single shared Prisma client in [src/lib/prisma.ts](/Users/achyu/Documents/plug/src/lib/prisma.ts).
- No duplicate app-runtime `new PrismaClient()` calls remain outside that file.
- Two standalone scripts still instantiate Prisma directly:
  - `scripts/create-admin.mjs`
  - `scripts/process-payouts.mjs`
  These are not request-serving code paths.

## Changes made

### Shared client hardening

- Expanded Supabase URL normalization to all Supabase hosts, not just `pooler.supabase.com`.
- Ensures `connection_limit=1` and `pool_timeout=30` are applied consistently to app runtime connections.
- Global singleton caching is now applied unconditionally per process.

### Hot route trims

- `GET /api/conversations`
  - unified conversation search and profile search into one request
  - avoids the extra `/api/users` call from Messages search
  - reduced payload with explicit `select`
- `GET /api/conversations/[id]/messages`
  - collapsed authorization check + message load into one DB query
- `POST /api/conversations/[id]/messages`
  - removed the interactive transaction around create/update
  - now does a simple auth check, create, then timestamp update
- `useSavedListings`
  - added short-lived sessionStorage caching to reduce repeated `/api/saves` hits across navigation

## Remaining risk areas

These were left functionally unchanged but remain worth monitoring:

- `GET /api/pop-score`
  - fans out into many parallel `count()` queries per request
  - acceptable for now, but still a concentrated DB hotspot
- Trade duel routes and services
  - still use transactions for correctness
  - acceptable, but these are higher-cost than simple feed reads
- Polling surfaces
  - auction room, trade detail, and duel pages still poll
  - query volume depends on active users and poll interval
- Stream inventory manager
  - host queue endpoints still perform several reads per refresh

## Recommended next steps

- Add request-level caching or short TTL caching for pop-score responses beyond the current route cache if traffic rises.
- Revisit polling intervals for trade/duel pages if concurrency increases.
- Consider consolidating some trade detail reads if those pages become a measurable hotspot.
