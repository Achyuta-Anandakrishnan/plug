# Supabase Adoption Plan (Phase 0)

## Immediate goals
- Move stream chat from polling to Supabase Realtime channels.
- Persist stream presence/watchers in Supabase for fast counters.
- Keep Prisma for transactional auction/order writes while layering Supabase for live UX.

## Phase 1 (this week)
1. Add a single `realtime-streams` channel pattern: `stream:<auctionId>`.
2. Publish auction chat messages to the channel after API writes.
3. Subscribe in stream room clients and append messages in-memory.
4. Add fallback to existing polling for reliability.

## Phase 2
1. Add presence tracking (`watcher_count`) per room.
2. Mirror stream lifecycle events (`live`, `offline`, `bid_placed`) to the channel.
3. Remove high-frequency polling from stream room screens.

## Phase 3
1. Evaluate moving chat storage to Supabase Postgres tables with RLS.
2. Keep payments/orders/admin logic on Prisma until parity is confirmed.
3. Add dashboards for realtime delivery errors and channel disconnect rate.

## Guardrails
- Do not move payments or order settlement out of current Prisma flows yet.
- Keep auth checks server-side in Next API routes.
- Roll out behind feature flags per route (`NEXT_PUBLIC_SUPABASE_STREAMS_REALTIME=1`).
