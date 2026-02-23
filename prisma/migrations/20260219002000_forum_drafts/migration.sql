DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumPostStatus') THEN
    CREATE TYPE "ForumPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');
  END IF;
END $$;

ALTER TABLE "ForumPost"
ADD COLUMN IF NOT EXISTS "status" "ForumPostStatus" NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE "ForumPost"
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ForumPost_status_idx" ON "ForumPost"("status");

UPDATE "ForumPost"
SET "publishedAt" = COALESCE("publishedAt", "createdAt")
WHERE "status" = 'PUBLISHED';
