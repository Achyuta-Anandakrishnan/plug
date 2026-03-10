import "server-only";
import { prisma } from "@/lib/prisma";

let ensureTradeSchemaPromise: Promise<void> | null = null;

export async function ensureTradeSchema() {
  if (ensureTradeSchemaPromise) {
    return ensureTradeSchemaPromise;
  }

  ensureTradeSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradePostStatus') THEN
          CREATE TYPE "TradePostStatus" AS ENUM ('OPEN', 'PAUSED', 'MATCHED', 'CLOSED', 'ARCHIVED');
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradeOfferStatus') THEN
          CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'COUNTERED');
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradeSettlementStatus') THEN
          CREATE TYPE "TradeSettlementStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TradePost" (
        "id" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
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
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TradePostImage" (
        "id" TEXT NOT NULL,
        "postId" TEXT NOT NULL REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "url" TEXT NOT NULL,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TradePostImage_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TradeOffer" (
        "id" TEXT NOT NULL,
        "postId" TEXT NOT NULL REFERENCES "TradePost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "proposerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "message" TEXT,
        "cashAdjustment" INTEGER NOT NULL DEFAULT 0,
        "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TradeOfferCard" (
        "id" TEXT NOT NULL,
        "offerId" TEXT NOT NULL REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
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
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TradeSettlement" (
        "id" TEXT NOT NULL,
        "offerId" TEXT NOT NULL REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "payerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "payeeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "amount" INTEGER NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'usd',
        "status" "TradeSettlementStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
        "providerPaymentIntent" TEXT,
        "providerCheckoutSession" TEXT,
        "providerChargeId" TEXT,
        "paidAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TradeSettlement_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradePost_ownerId_idx" ON "TradePost"("ownerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradePost_status_idx" ON "TradePost"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradePost_createdAt_idx" ON "TradePost"("createdAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradePostImage_postId_idx" ON "TradePostImage"("postId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeOffer_postId_idx" ON "TradeOffer"("postId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeOffer_proposerId_idx" ON "TradeOffer"("proposerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeOffer_status_idx" ON "TradeOffer"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeOfferCard_offerId_idx" ON "TradeOfferCard"("offerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeSettlement_payerId_idx" ON "TradeSettlement"("payerId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeSettlement_payeeId_idx" ON "TradeSettlement"("payeeId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TradeSettlement_status_idx" ON "TradeSettlement"("status");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "TradeSettlement_offerId_key" ON "TradeSettlement"("offerId");`);
  })().catch((error) => {
    ensureTradeSchemaPromise = null;
    throw error;
  });

  return ensureTradeSchemaPromise;
}

export function isTradeSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  const metaModel = "meta" in error && (error as { meta?: { modelName?: unknown } }).meta
    ? String((error as { meta?: { modelName?: unknown } }).meta?.modelName ?? "")
    : "";

  if (code === "P2021") {
    return metaModel.includes("Trade");
  }

  if (code === "42P01" || code === "42704") {
    return message.includes("Trade");
  }

  return message.includes("TradePost")
    || message.includes("TradeOffer")
    || message.includes("TradeSettlement");
}
