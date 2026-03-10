import "server-only";
import { prisma } from "@/lib/prisma";

let ensureVerifyCardSchemaPromise: Promise<void> | null = null;

export async function ensureVerifyCardSchema() {
  if (ensureVerifyCardSchemaPromise) {
    return ensureVerifyCardSchemaPromise;
  }

  ensureVerifyCardSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VerifiedCardCache" (
        "grader" TEXT NOT NULL,
        "certNumber" TEXT NOT NULL,
        "normalized" JSONB NOT NULL,
        "sourcePayload" JSONB,
        "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VerifiedCardCache_pkey" PRIMARY KEY ("grader", "certNumber")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "VerifiedCardCache_expiresAt_idx"
      ON "VerifiedCardCache" ("expiresAt");
    `);
  })().catch((error) => {
    ensureVerifyCardSchemaPromise = null;
    throw error;
  });

  return ensureVerifyCardSchemaPromise;
}
