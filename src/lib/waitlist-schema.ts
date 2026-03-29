import "server-only";

import { prisma } from "@/lib/prisma";

let ensureWaitlistSchemaPromise: Promise<void> | null = null;

const WAITLIST_SCHEMA_STATEMENTS = [
  `
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);
`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_email_key" ON "WaitlistEntry"("email");`,
  `CREATE INDEX IF NOT EXISTS "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");`,
];

export async function ensureWaitlistSchema() {
  if (!ensureWaitlistSchemaPromise) {
    ensureWaitlistSchemaPromise = (async () => {
      for (const statement of WAITLIST_SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      ensureWaitlistSchemaPromise = null;
      throw error;
    });
  }

  await ensureWaitlistSchemaPromise;
}

export function isWaitlistSchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /WaitlistEntry|relation .* does not exist|column .* does not exist/i.test(message);
}
