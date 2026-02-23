ALTER TABLE "ForumComment"
ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE INDEX IF NOT EXISTS "ForumComment_parentId_idx" ON "ForumComment"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ForumComment_parentId_fkey'
  ) THEN
    ALTER TABLE "ForumComment"
    ADD CONSTRAINT "ForumComment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ForumComment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
