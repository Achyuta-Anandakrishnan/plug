-- Game-based counter offer consent fields.

ALTER TABLE "TradeOffer"
ADD COLUMN "gameType" TEXT,
ADD COLUMN "gameTerms" TEXT,
ADD COLUMN "gameTermsVersion" INTEGER,
ADD COLUMN "gameProposedById" TEXT,
ADD COLUMN "gameOwnerAgreedAt" TIMESTAMP(3),
ADD COLUMN "gameProposerAgreedAt" TIMESTAMP(3),
ADD COLUMN "gameLockedAt" TIMESTAMP(3),
ADD COLUMN "gameStartedAt" TIMESTAMP(3),
ADD COLUMN "gameResolvedAt" TIMESTAMP(3),
ADD COLUMN "gameWinnerId" TEXT;

CREATE INDEX "TradeOffer_gameType_idx" ON "TradeOffer"("gameType");
CREATE INDEX "TradeOffer_gameLockedAt_idx" ON "TradeOffer"("gameLockedAt");
