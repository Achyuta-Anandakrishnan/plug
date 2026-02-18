import "server-only";
import { prisma } from "@/lib/prisma";

let ensureForumSchemaPromise: Promise<void> | null = null;

export async function ensureForumSchema() {
  if (ensureForumSchemaPromise) {
    return ensureForumSchemaPromise;
  }

  ensureForumSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ForumPost" (
        "id" TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
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
      `CREATE INDEX IF NOT EXISTS "ForumComment_postId_idx" ON "ForumComment"("postId");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ForumComment_authorId_idx" ON "ForumComment"("authorId");`,
    );
  })().catch((error) => {
    ensureForumSchemaPromise = null;
    throw error;
  });

  return ensureForumSchemaPromise;
}

