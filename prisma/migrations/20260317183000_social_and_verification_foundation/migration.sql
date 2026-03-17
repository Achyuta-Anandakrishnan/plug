ALTER TABLE "TradeOffer"
ADD COLUMN IF NOT EXISTS "gameState" JSONB,
ADD COLUMN IF NOT EXISTS "gameStateVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserSave" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "auctionId" TEXT,
  "tradePostId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StreamReminder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "auctionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserFollow" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX IF NOT EXISTS "UserSave_userId_auctionId_key" ON "UserSave"("userId", "auctionId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSave_userId_tradePostId_key" ON "UserSave"("userId", "tradePostId");
CREATE INDEX IF NOT EXISTS "UserSave_userId_createdAt_idx" ON "UserSave"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserSave_auctionId_idx" ON "UserSave"("auctionId");
CREATE INDEX IF NOT EXISTS "UserSave_tradePostId_idx" ON "UserSave"("tradePostId");

CREATE UNIQUE INDEX IF NOT EXISTS "StreamReminder_userId_auctionId_key" ON "StreamReminder"("userId", "auctionId");
CREATE INDEX IF NOT EXISTS "StreamReminder_auctionId_idx" ON "StreamReminder"("auctionId");
CREATE INDEX IF NOT EXISTS "StreamReminder_userId_createdAt_idx" ON "StreamReminder"("userId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "UserFollow_followingId_createdAt_idx" ON "UserFollow"("followingId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserFollow_followerId_createdAt_idx" ON "UserFollow"("followerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_createdAt_idx" ON "EmailVerificationToken"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_email_expiresAt_idx" ON "EmailVerificationToken"("email", "expiresAt");

CREATE INDEX IF NOT EXISTS "VerifiedCardCache_expiresAt_idx" ON "VerifiedCardCache"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserSave_userId_fkey'
  ) THEN
    ALTER TABLE "UserSave"
    ADD CONSTRAINT "UserSave_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserSave_auctionId_fkey'
  ) THEN
    ALTER TABLE "UserSave"
    ADD CONSTRAINT "UserSave_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserSave_tradePostId_fkey'
  ) THEN
    ALTER TABLE "UserSave"
    ADD CONSTRAINT "UserSave_tradePostId_fkey"
    FOREIGN KEY ("tradePostId") REFERENCES "TradePost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StreamReminder_userId_fkey'
  ) THEN
    ALTER TABLE "StreamReminder"
    ADD CONSTRAINT "StreamReminder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StreamReminder_auctionId_fkey'
  ) THEN
    ALTER TABLE "StreamReminder"
    ADD CONSTRAINT "StreamReminder_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followerId_fkey'
  ) THEN
    ALTER TABLE "UserFollow"
    ADD CONSTRAINT "UserFollow_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followingId_fkey'
  ) THEN
    ALTER TABLE "UserFollow"
    ADD CONSTRAINT "UserFollow_followingId_fkey"
    FOREIGN KEY ("followingId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey'
  ) THEN
    ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
