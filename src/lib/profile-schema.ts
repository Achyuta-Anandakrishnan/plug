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
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "usernameChangeCount" INTEGER NOT NULL DEFAULT 0;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "usernameChangePeriodStart" TIMESTAMP(3);
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

export function isProfileSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  const metaColumn = "meta" in error && (error as { meta?: { column?: unknown } }).meta
    ? String((error as { meta?: { column?: unknown } }).meta?.column ?? "")
    : "";
  if (code === "42703") return true;
  if (code === "P2022" && ["username", "bio", "displayName"].includes(metaColumn)) return true;
  return message.includes("username") || message.includes("bio");
}
