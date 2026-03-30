# Beta Release Checklist

## Branch hygiene
- [ ] `git status` is clean
- [ ] only intended release changes are committed
- [ ] no local-only debugging or stray scaffolding is mixed into the branch cut

## Database
- [ ] `prisma/migrations` is complete and committed
- [ ] target DB is reachable through `DIRECT_URL`
- [ ] `npx prisma migrate deploy` has been run on the beta database
- [ ] `npx prisma generate` has been run after the final schema state

## Environment
- [ ] beta env matches [.env.example](/Users/achyu/Documents/plug/.env.example)
- [ ] auth secrets are set:
  - [ ] `NEXTAUTH_SECRET`
  - [ ] `NATIVE_AUTH_SECRET`
- [ ] database env is set:
  - [ ] `DATABASE_URL`
  - [ ] `DIRECT_URL`
- [ ] storage env is set:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_BUCKET`
- [ ] payments env is set:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_PUBLISHABLE_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] streaming env is set:
  - [ ] `LIVEKIT_URL`
  - [ ] `LIVEKIT_API_KEY`
  - [ ] `LIVEKIT_API_SECRET`
- [ ] email env is set:
  - [ ] `SMTP_HOST`
  - [ ] `SMTP_PORT`
  - [ ] `SMTP_USER`
  - [ ] `SMTP_PASS`
  - [ ] `SMTP_FROM`
  - [ ] `NOTIFY_EMAIL`
- [ ] recommended abuse controls are set:
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `TURNSTILE_SECRET_KEY`

## Stripe
- [ ] Stripe webhook points to `/api/payments/webhook`
- [ ] webhook secret matches deployed env
- [ ] Stripe Connect onboarding works from `/settings/payments`
- [ ] seller payout readiness blocks/permits listing correctly

## Supabase / Postgres
- [ ] storage bucket exists
- [ ] public media behavior is explicitly accepted for beta
- [ ] connection pooling behavior is acceptable in target environment

## QA support
- [ ] run `npm run qa:seed` in beta/staging if appropriate
- [ ] follow [docs/launch-qa-matrix.md](/Users/achyu/Documents/plug/docs/launch-qa-matrix.md)

## Final verification
- [ ] `npm test`
- [ ] `npm run build`
- [ ] smoke test completed for:
  - [ ] sign up / login
  - [ ] seller onboarding
  - [ ] create listing
  - [ ] buy now
  - [ ] bid
  - [ ] start live room
  - [ ] add stream inventory
  - [ ] trade post
  - [ ] trade offer
  - [ ] duel / settlement
  - [ ] bounty
  - [ ] messages
  - [ ] admin actions

## Current visible blockers
- [ ] dirty worktree resolved before branch cut
- [ ] deploy env audited against docs
- [ ] migrations applied on target beta DB
