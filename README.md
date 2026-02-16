This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Backend + Database

1) Copy env vars:

```bash
cp .env.example .env
```

2) Start Postgres (optional local dev):

```bash
docker compose up -d
```

3) Run Prisma migrations:

```bash
npx prisma migrate dev
npx prisma generate
```

## Admin

Create an admin account (for review dashboard access):

```bash
npm run create-admin -- --email you@example.com --name "Admin"
```

Set `ADMIN_KEY` in `.env` and use it in the admin dashboard header input.
Admin dashboard: `/admin/sellers`.

## Email

Configure SMTP in `.env` to send seller verification notifications. The default
notify address is `NOTIFY_EMAIL`.

## Auth

Set `NEXTAUTH_URL` and `NEXTAUTH_SECRET`, plus OAuth credentials for Google and
Apple in `.env` to enable social sign-in.

## API Routes

- `GET /api/categories`
- `POST /api/categories`
- `POST /api/signup`
- `GET /api/auctions`
- `POST /api/auctions`
- `GET /api/auctions/:id`
- `POST /api/auctions/:id/bids`
- `GET /api/auctions/:id/chat`
- `POST /api/auctions/:id/chat`
- `POST /api/sellers/apply`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`
- `POST /api/referrals`

Note: API routes use NextAuth server sessions for auth. Admin routes may also accept `x-admin-key` as an escape hatch for local tooling.

## Hosting

See `docs/hosting.md` for the recommended stack and deployment steps.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
