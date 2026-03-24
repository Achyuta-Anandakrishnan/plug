CREATE TABLE IF NOT EXISTS "TradeDuel" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "challengerId" TEXT NOT NULL,
  "defenderId" TEXT NOT NULL,
  "winnerId" TEXT,
  "mode" TEXT NOT NULL,
  "terms" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "challengerAgreedAt" TIMESTAMP(3),
  "defenderAgreedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "deadlineAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "resultReason" TEXT,
  "baselineSnapshot" JSONB,
  "state" JSONB,
  "stateVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeDuel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TradeDuel_offerId_key" ON "TradeDuel"("offerId");
CREATE INDEX IF NOT EXISTS "TradeDuel_postId_idx" ON "TradeDuel"("postId");
CREATE INDEX IF NOT EXISTS "TradeDuel_challengerId_idx" ON "TradeDuel"("challengerId");
CREATE INDEX IF NOT EXISTS "TradeDuel_defenderId_idx" ON "TradeDuel"("defenderId");
CREATE INDEX IF NOT EXISTS "TradeDuel_winnerId_idx" ON "TradeDuel"("winnerId");
CREATE INDEX IF NOT EXISTS "TradeDuel_status_idx" ON "TradeDuel"("status");
CREATE INDEX IF NOT EXISTS "TradeDuel_scheduledFor_idx" ON "TradeDuel"("scheduledFor");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeDuel_offerId_fkey'
  ) THEN
    ALTER TABLE "TradeDuel"
    ADD CONSTRAINT "TradeDuel_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeDuel_postId_fkey'
  ) THEN
    ALTER TABLE "TradeDuel"
    ADD CONSTRAINT "TradeDuel_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "TradePost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeDuel_challengerId_fkey'
  ) THEN
    ALTER TABLE "TradeDuel"
    ADD CONSTRAINT "TradeDuel_challengerId_fkey"
    FOREIGN KEY ("challengerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeDuel_defenderId_fkey'
  ) THEN
    ALTER TABLE "TradeDuel"
    ADD CONSTRAINT "TradeDuel_defenderId_fkey"
    FOREIGN KEY ("defenderId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeDuel_winnerId_fkey'
  ) THEN
    ALTER TABLE "TradeDuel"
    ADD CONSTRAINT "TradeDuel_winnerId_fkey"
    FOREIGN KEY ("winnerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
