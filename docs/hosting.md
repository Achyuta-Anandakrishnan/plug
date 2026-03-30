# Hosting and Deploy Runbook

## Recommended production stack
- Web app + API: Vercel
- Database: Supabase Postgres or Neon Postgres
- Storage: Supabase Storage
- Payments: Stripe + Stripe Connect Express
- Live video: LiveKit
- Rate limiting: Upstash Redis

## Environment requirements

### Required for beta
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NATIVE_AUTH_SECRET`
- `ADMIN_EMAILS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NOTIFY_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`

### Strongly recommended for beta stability
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TURNSTILE_SECRET_KEY`

### Optional feature integrations
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_SECRET`
- `PSA_PUBLIC_API_KEY`
- `SCRAPINGBEE_API_KEY`
- `JUSTTCG_API_KEY`

## Postgres / Supabase expectations

- `DATABASE_URL` should point at the pooled or transaction-safe runtime connection.
- `DIRECT_URL` should point at the direct Postgres host used for Prisma migrations.
- Production should not depend on runtime schema repair during requests.
- A fresh environment should be created from Prisma migrations only.
- Runtime Prisma usage is tuned for Supabase-style pooling, but that does not replace correct database sizing.

### Current expectation for Prisma
- Run schema changes through `prisma/migrations`
- Do not rely on request-time table/column creation
- Use `npx prisma migrate deploy` in deployed environments

## Stripe setup

This app expects both buyer-side Stripe usage and seller-side Stripe Connect onboarding.

### Buyer payments
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Seller payouts
- Stripe Connect Express is used through `/api/stripe/connect`
- Sellers are expected to complete onboarding before listing/stream selling actions are allowed
- Seller payout readiness is derived server-side from Stripe account state

### Stripe operational requirements
- Webhook endpoint must be deployed and reachable:
  - `/api/payments/webhook`
- Webhook secret must match the deployed Stripe endpoint
- Platform account must have Connect enabled

## Supabase storage expectations

- Create the bucket named by `SUPABASE_BUCKET` or use the default `auction-images`
- The current app assumes public object URLs for media delivery
- Service-role credentials are required server-side for uploads and storage operations

## Migration and deploy order

Use this order for beta or production deploys:

1. Merge only committed, reviewed changes into the release branch
2. Confirm `.env` / platform env vars are complete
3. Run Prisma migrations against the target database:
   - `npx prisma migrate deploy`
4. Run Prisma client generation if needed:
   - `npx prisma generate`
5. Deploy the app
6. Verify Stripe webhook configuration
7. Verify Supabase bucket access
8. Smoke-test:
   - login
   - seller onboarding
   - listing creation
   - buy now
   - bid
   - live room start
   - trade offer
   - bounty
   - messages
   - admin pages

## Beta branch expectations

Before cutting a beta branch:
- worktree must be clean
- migrations must be committed
- `.env.example` must match real required env shape
- build must pass
- launch QA checklist should be ready for manual verification

## Operational notes

- Supabase / Postgres connection pool exhaustion is still a meaningful operational risk if Redis-backed limits and prudent query behavior are not configured in production
- Public media URLs remain a privacy tradeoff
- Admin email fallback behavior exists and should be treated as a controlled operational shortcut, not the ideal long-term admin model
