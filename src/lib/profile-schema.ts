import "server-only";
import { prisma } from "@/lib/prisma";

export async function ensureProfileSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
  `);
}

export function isProfileSchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("accountStatus");
}
