import "server-only";
import { prisma } from "@/lib/prisma";

let ensureForumSchemaPromise: Promise<void> | null = null;

export async function ensureForumSchema() {
  if (ensureForumSchemaPromise) {
    return ensureForumSchemaPromise;
  }

  ensureForumSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumPostStatus') THEN
          CREATE TYPE "ForumPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ForumPost" (
        "id" TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "status" "ForumPostStatus" NOT NULL DEFAULT 'PUBLISHED',
        "publishedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ForumComment" (
        "id" TEXT NOT NULL,
        "postId" TEXT NOT NULL REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost"("authorId");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumPost_status_idx" ON "ForumPost"("status");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumComment_postId_idx" ON "ForumComment"("postId");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumComment_authorId_idx" ON "ForumComment"("authorId");`,
    );

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ForumPost"
      ADD COLUMN IF NOT EXISTS "status" "ForumPostStatus" NOT NULL DEFAULT 'PUBLISHED';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ForumPost"
      ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "ForumPost"
      SET "publishedAt" = COALESCE("publishedAt", "createdAt")
      WHERE "status" = 'PUBLISHED';
    `);
  })().catch((error) => {
    ensureForumSchemaPromise = null;
    throw error;
  });

  return ensureForumSchemaPromise;
}
