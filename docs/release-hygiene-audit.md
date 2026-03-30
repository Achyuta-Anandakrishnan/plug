# Release Hygiene Audit

## Visible local-state-dependent behavior

### Dirty worktree
The repo currently has a large set of modified and untracked files. That is the main blocker to a clean beta branch cut because:
- it is hard to know exactly what is intended to ship
- release validation becomes ambiguous
- rollback and cherry-pick decisions get riskier

### Local `.env` dependency
The app relies heavily on environment configuration for:
- auth
- Stripe
- Supabase storage
- Postgres
- LiveKit
- email
- optional Redis rate limiting

This is expected, but it means beta readiness depends on environment parity, not just code parity.

### Dev-only seed route
- `/api/dev/seed` exists and is correctly blocked in production
- this is acceptable for QA, but should stay disabled outside non-production environments

### Public media assumption
- uploaded media currently uses public Supabase URLs
- not a branch-cut blocker by itself, but it is an operational/privacy decision that should be explicitly accepted before beta

### Optional-but-important operational dependencies
- Upstash Redis is optional in code, but falling back to in-memory rate limiting is weaker in multi-instance production
- Stripe Connect readiness depends on correct live Stripe configuration and webhook handling

## What should be true before cutting beta

1. `git status` is clean
2. required env vars are documented and present in the target environment
3. Prisma migrations are committed and applied with `prisma migrate deploy`
4. build passes on the exact branch to be deployed
5. QA seed and manual QA checklist are ready

## Current blockers visible from repo state

1. Dirty worktree with many modified/untracked files
2. Recent docs/test/scaffolding changes are not yet clearly grouped into a reviewed release set
3. Environment contract needed cleanup and should be rechecked against the actual deploy target before branch cut
