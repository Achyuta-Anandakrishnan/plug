-- Trade settlements with Stripe checkout support.

CREATE TYPE "TradeSettlementStatus" AS ENUM (
  'REQUIRES_PAYMENT',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED'
);

CREATE TABLE "TradeSettlement" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TradeSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeSettlement_offerId_key" ON "TradeSettlement"("offerId");
CREATE INDEX "TradeSettlement_payerId_idx" ON "TradeSettlement"("payerId");
CREATE INDEX "TradeSettlement_payeeId_idx" ON "TradeSettlement"("payeeId");
CREATE INDEX "TradeSettlement_status_idx" ON "TradeSettlement"("status");

ALTER TABLE "TradeSettlement"
ADD CONSTRAINT "TradeSettlement_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeSettlement"
ADD CONSTRAINT "TradeSettlement_payerId_fkey"
FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeSettlement"
ADD CONSTRAINT "TradeSettlement_payeeId_fkey"
FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
