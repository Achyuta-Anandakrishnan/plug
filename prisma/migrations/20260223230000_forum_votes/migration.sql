CREATE TABLE IF NOT EXISTS "ForumPostVote" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ForumPostVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ForumPostVote_postId_userId_key" ON "ForumPostVote"("postId", "userId");
CREATE INDEX IF NOT EXISTS "ForumPostVote_postId_idx" ON "ForumPostVote"("postId");
CREATE INDEX IF NOT EXISTS "ForumPostVote_userId_idx" ON "ForumPostVote"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ForumPostVote_postId_fkey'
  ) THEN
    ALTER TABLE "ForumPostVote"
    ADD CONSTRAINT "ForumPostVote_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "ForumPost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ForumPostVote_userId_fkey'
  ) THEN
    ALTER TABLE "ForumPostVote"
    ADD CONSTRAINT "ForumPostVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
