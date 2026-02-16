# Hosting plan

## Recommended production stack
- Web app + API: Vercel (Next.js App Router, route handlers)
- Database: Postgres on Neon or Supabase (serverless, autoscaling)
- Realtime chat + presence: Ably or Pusher
- Live video: LiveKit (low latency) or Mux Live (broadcast scale)
- Asset storage: S3 or Cloudflare R2
- Background jobs: Inngest or Trigger.dev

## Vercel setup
1) Create a Vercel project from this repo.
2) Set environment variables from `.env.example`.
3) Configure build command: `npm run build`.
4) Configure output: Next.js default.
5) Add a custom domain.

## Database setup
- Create a Postgres database on Neon/Supabase.
- Copy the connection string to `DATABASE_URL`.
- For serverless (Vercel), use the Supabase transaction pooler for `DATABASE_URL` and set `DIRECT_URL` to the direct connection for migrations.
- Run migrations locally:
  - `npx prisma migrate dev`
  - `npx prisma generate`

## Streaming setup
- LiveKit: create a project, set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Mux Live: create a live stream profile, set `MUX_*` env vars.
- Use signed tokens from your backend (do not expose secrets to the client).

## Supabase storage
- Create a bucket (default `auction-images`) and set it to public if you want simple public URLs.
- Set `SUPABASE_BUCKET` if you want a custom bucket name.
- Run `npm run setup-supabase` to apply Prisma migrations and create/update the bucket.

## Security defaults
- Enforce HTTPS only.
- Use `x-forwarded-proto` checks in production.
- Add rate limiting for bids and chat.
- Store audit logs in a separate table or log pipeline.

## Operational notes
- Enable Vercel cron or background jobs for auction end processing.
- Use a message queue for high traffic bid bursts.
- Add Redis for hot auction state if needed.
