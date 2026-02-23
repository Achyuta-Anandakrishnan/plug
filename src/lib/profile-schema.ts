import "server-only";
import { prisma } from "@/lib/prisma";

let ensureProfileSchemaPromise: Promise<void> | null = null;

function isPostgresUrl() {
  const value = process.env.DATABASE_URL ?? "";
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export async function ensureProfileSchema() {
  if (!isPostgresUrl()) return;
  if (ensureProfileSchemaPromise) return ensureProfileSchemaPromise;

  ensureProfileSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "username" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "bio" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
    `);
  })().catch((error) => {
    ensureProfileSchemaPromise = null;
    throw error;
  });

  return ensureProfileSchemaPromise;
}
