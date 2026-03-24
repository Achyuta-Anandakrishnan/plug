import "server-only";

import { prisma } from "@/lib/prisma";

let ensureTradeSchemaPromise: Promise<void> | null = null;

const TRADE_SCHEMA_STATEMENTS = [
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TradePostStatus'
  ) THEN
    CREATE TYPE "TradePostStatus" AS ENUM ('OPEN', 'PAUSED', 'MATCHED', 'CLOSED', 'ARCHIVED');
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TradeOfferStatus'
  ) THEN
    CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'COUNTERED');
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TradeSettlementStatus'
  ) THEN
    CREATE TYPE "TradeSettlementStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
  END IF;
END $$;
`,
  `
CREATE TABLE IF NOT EXISTS "TradeOffer" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "proposerId" TEXT NOT NULL,
  "message" TEXT,
  "cashAdjustment" INTEGER NOT NULL DEFAULT 0,
  "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);
`,
  `
CREATE TABLE IF NOT EXISTS "TradeOfferCard" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "cardSet" TEXT,
  "cardNumber" TEXT,
  "condition" TEXT,
  "gradeCompany" TEXT,
  "gradeLabel" TEXT,
  "estimatedValue" INTEGER,
  "imageUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeOfferCard_pkey" PRIMARY KEY ("id")
);
`,
  `
CREATE TABLE IF NOT EXISTS "TradeSettlement" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "payerId" TEXT NOT NULL,
  "payeeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "TradeSettlementStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
  "providerPaymentIntent" TEXT,
  "providerCheckoutSession" TEXT,
  "providerChargeId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeSettlement_pkey" PRIMARY KEY ("id")
);
`,
  `
ALTER TABLE "TradeOffer"
ADD COLUMN IF NOT EXISTS "gameType" TEXT,
ADD COLUMN IF NOT EXISTS "gameTerms" TEXT,
ADD COLUMN IF NOT EXISTS "gameTermsVersion" INTEGER,
ADD COLUMN IF NOT EXISTS "gameProposedById" TEXT,
ADD COLUMN IF NOT EXISTS "gameOwnerAgreedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gameProposerAgreedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gameLockedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gameStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gameResolvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gameWinnerId" TEXT,
ADD COLUMN IF NOT EXISTS "gameState" JSONB,
ADD COLUMN IF NOT EXISTS "gameStateVersion" INTEGER NOT NULL DEFAULT 0;
`,
  `CREATE INDEX IF NOT EXISTS "TradeOffer_postId_idx" ON "TradeOffer"("postId");`,
  `CREATE INDEX IF NOT EXISTS "TradeOffer_proposerId_idx" ON "TradeOffer"("proposerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeOffer_status_idx" ON "TradeOffer"("status");`,
  `CREATE INDEX IF NOT EXISTS "TradeOffer_gameType_idx" ON "TradeOffer"("gameType");`,
  `CREATE INDEX IF NOT EXISTS "TradeOffer_gameLockedAt_idx" ON "TradeOffer"("gameLockedAt");`,
  `CREATE INDEX IF NOT EXISTS "TradeOfferCard_offerId_idx" ON "TradeOfferCard"("offerId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TradeSettlement_offerId_key" ON "TradeSettlement"("offerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeSettlement_payerId_idx" ON "TradeSettlement"("payerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeSettlement_payeeId_idx" ON "TradeSettlement"("payeeId");`,
  `CREATE INDEX IF NOT EXISTS "TradeSettlement_status_idx" ON "TradeSettlement"("status");`,
  `
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
`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TradeDuel_offerId_key" ON "TradeDuel"("offerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_postId_idx" ON "TradeDuel"("postId");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_challengerId_idx" ON "TradeDuel"("challengerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_defenderId_idx" ON "TradeDuel"("defenderId");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_winnerId_idx" ON "TradeDuel"("winnerId");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_status_idx" ON "TradeDuel"("status");`,
  `CREATE INDEX IF NOT EXISTS "TradeDuel_scheduledFor_idx" ON "TradeDuel"("scheduledFor");`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeOffer_postId_fkey'
  ) THEN
    ALTER TABLE "TradeOffer"
    ADD CONSTRAINT "TradeOffer_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "TradePost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeOffer_proposerId_fkey'
  ) THEN
    ALTER TABLE "TradeOffer"
    ADD CONSTRAINT "TradeOffer_proposerId_fkey"
    FOREIGN KEY ("proposerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeOfferCard_offerId_fkey'
  ) THEN
    ALTER TABLE "TradeOfferCard"
    ADD CONSTRAINT "TradeOfferCard_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeSettlement_offerId_fkey'
  ) THEN
    ALTER TABLE "TradeSettlement"
    ADD CONSTRAINT "TradeSettlement_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeSettlement_payerId_fkey'
  ) THEN
    ALTER TABLE "TradeSettlement"
    ADD CONSTRAINT "TradeSettlement_payerId_fkey"
    FOREIGN KEY ("payerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TradeSettlement_payeeId_fkey'
  ) THEN
    ALTER TABLE "TradeSettlement"
    ADD CONSTRAINT "TradeSettlement_payeeId_fkey"
    FOREIGN KEY ("payeeId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `
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
`,
  `
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
`,
  `
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
`,
  `
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
`,
  `
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
`,
];

export async function ensureTradeSchema() {
  if (!ensureTradeSchemaPromise) {
    ensureTradeSchemaPromise = (async () => {
      for (const statement of TRADE_SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      ensureTradeSchemaPromise = null;
      throw error;
    });
  }

  await ensureTradeSchemaPromise;
}

export function isTradeSchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /TradeOffer|TradeOfferCard|TradeSettlement|TradeDuel|TradePost|column .* does not exist|relation .* does not exist/i.test(message);
}
