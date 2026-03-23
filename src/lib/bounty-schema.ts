import "server-only";

import { prisma } from "@/lib/prisma";

let ensureBountySchemaPromise: Promise<void> | null = null;

const BOUNTY_SCHEMA_STATEMENTS = [
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'WantRequestStatus'
  ) THEN
    CREATE TYPE "WantRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'EXPIRED', 'PAUSED');
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  ALTER TYPE "WantRequestStatus" ADD VALUE IF NOT EXISTS 'MATCHED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`,
  `
CREATE TABLE IF NOT EXISTS "WantRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "itemName" TEXT NOT NULL,
  "player" TEXT,
  "setName" TEXT,
  "year" TEXT,
  "gradeCompany" TEXT,
  "gradeTarget" TEXT,
  "grade" TEXT,
  "condition" TEXT,
  "certNumber" TEXT,
  "priceMin" INTEGER,
  "priceMax" INTEGER,
  "bountyAmount" INTEGER,
  "notes" TEXT,
  "imageUrl" TEXT,
  "status" "WantRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WantRequest_pkey" PRIMARY KEY ("id")
);
`,
  `
ALTER TABLE "WantRequest"
ADD COLUMN IF NOT EXISTS "player" TEXT,
ADD COLUMN IF NOT EXISTS "setName" TEXT,
ADD COLUMN IF NOT EXISTS "year" TEXT,
ADD COLUMN IF NOT EXISTS "gradeCompany" TEXT,
ADD COLUMN IF NOT EXISTS "gradeTarget" TEXT,
ADD COLUMN IF NOT EXISTS "bountyAmount" INTEGER;
`,
  `CREATE INDEX IF NOT EXISTS "WantRequest_userId_idx" ON "WantRequest"("userId");`,
  `CREATE INDEX IF NOT EXISTS "WantRequest_status_idx" ON "WantRequest"("status");`,
  `CREATE INDEX IF NOT EXISTS "WantRequest_createdAt_idx" ON "WantRequest"("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "WantRequest_category_idx" ON "WantRequest"("category");`,
  `CREATE INDEX IF NOT EXISTS "WantRequest_bountyAmount_idx" ON "WantRequest"("bountyAmount");`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WantRequest_userId_fkey'
  ) THEN
    ALTER TABLE "WantRequest"
    ADD CONSTRAINT "WantRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
];

export async function ensureBountySchema() {
  if (!ensureBountySchemaPromise) {
    ensureBountySchemaPromise = (async () => {
      for (const statement of BOUNTY_SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      ensureBountySchemaPromise = null;
      throw error;
    });
  }

  await ensureBountySchemaPromise;
}

export function isBountySchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /WantRequest|WantRequestStatus|column .* does not exist|relation .* does not exist/i.test(message);
}
