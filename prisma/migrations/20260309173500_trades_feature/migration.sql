-- Trading feature: posts, images, offers, and offered cards.

CREATE TYPE "TradePostStatus" AS ENUM ('OPEN', 'PAUSED', 'MATCHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'COUNTERED');

CREATE TABLE "TradePost" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "cardSet" TEXT,
    "cardNumber" TEXT,
    "condition" TEXT,
    "gradeCompany" TEXT,
    "gradeLabel" TEXT,
    "lookingFor" TEXT NOT NULL,
    "preferredBrands" TEXT,
    "location" TEXT,
    "shippingMode" TEXT,
    "tags" JSONB,
    "valueMin" INTEGER,
    "valueMax" INTEGER,
    "status" "TradePostStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradePost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradePostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradePostImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "message" TEXT,
    "cashAdjustment" INTEGER NOT NULL DEFAULT 0,
    "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeOfferCard" (
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

CREATE INDEX "TradePost_ownerId_idx" ON "TradePost"("ownerId");
CREATE INDEX "TradePost_status_idx" ON "TradePost"("status");
CREATE INDEX "TradePost_createdAt_idx" ON "TradePost"("createdAt");
CREATE INDEX "TradePostImage_postId_idx" ON "TradePostImage"("postId");
CREATE INDEX "TradeOffer_postId_idx" ON "TradeOffer"("postId");
CREATE INDEX "TradeOffer_proposerId_idx" ON "TradeOffer"("proposerId");
CREATE INDEX "TradeOffer_status_idx" ON "TradeOffer"("status");
CREATE INDEX "TradeOfferCard_offerId_idx" ON "TradeOfferCard"("offerId");

ALTER TABLE "TradePost"
ADD CONSTRAINT "TradePost_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradePostImage"
ADD CONSTRAINT "TradePostImage_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeOffer"
ADD CONSTRAINT "TradeOffer_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeOffer"
ADD CONSTRAINT "TradeOffer_proposerId_fkey"
FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeOfferCard"
ADD CONSTRAINT "TradeOfferCard_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
