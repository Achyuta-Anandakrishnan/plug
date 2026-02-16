-- Ensure at most one active (non-canceled/non-refunded) order exists per auction.
-- This prevents double-purchases due to concurrent buy-now requests.
CREATE UNIQUE INDEX IF NOT EXISTS "Order_auctionId_active_unique"
ON "Order"("auctionId")
WHERE "status" NOT IN ('CANCELED', 'REFUNDED');

