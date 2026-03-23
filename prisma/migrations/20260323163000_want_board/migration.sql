DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'WantRequestStatus'
  ) THEN
    CREATE TYPE "WantRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'EXPIRED', 'PAUSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WantRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "itemName" TEXT NOT NULL,
  "grade" TEXT,
  "condition" TEXT,
  "certNumber" TEXT,
  "priceMin" INTEGER,
  "priceMax" INTEGER,
  "notes" TEXT,
  "imageUrl" TEXT,
  "status" "WantRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WantRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserSave"
ADD COLUMN IF NOT EXISTS "wantRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "WantRequest_userId_idx" ON "WantRequest"("userId");
CREATE INDEX IF NOT EXISTS "WantRequest_status_idx" ON "WantRequest"("status");
CREATE INDEX IF NOT EXISTS "WantRequest_createdAt_idx" ON "WantRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "WantRequest_category_idx" ON "WantRequest"("category");

CREATE UNIQUE INDEX IF NOT EXISTS "UserSave_userId_wantRequestId_key" ON "UserSave"("userId", "wantRequestId");
CREATE INDEX IF NOT EXISTS "UserSave_wantRequestId_idx" ON "UserSave"("wantRequestId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WantRequest_userId_fkey'
  ) THEN
    ALTER TABLE "WantRequest"
    ADD CONSTRAINT "WantRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserSave_wantRequestId_fkey'
  ) THEN
    ALTER TABLE "UserSave"
    ADD CONSTRAINT "UserSave_wantRequestId_fkey"
    FOREIGN KEY ("wantRequestId") REFERENCES "WantRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
