CREATE TABLE "StreamSessionItem" (
    "id" TEXT NOT NULL,
    "streamSessionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceAuctionId" TEXT,
    "sourceTradePostId" TEXT,
    "derivedAuctionId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "priceLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamSessionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamSessionItem_streamSessionId_position_idx" ON "StreamSessionItem"("streamSessionId", "position");
CREATE INDEX "StreamSessionItem_sourceAuctionId_idx" ON "StreamSessionItem"("sourceAuctionId");
CREATE INDEX "StreamSessionItem_sourceTradePostId_idx" ON "StreamSessionItem"("sourceTradePostId");
CREATE INDEX "StreamSessionItem_derivedAuctionId_idx" ON "StreamSessionItem"("derivedAuctionId");

ALTER TABLE "StreamSessionItem"
ADD CONSTRAINT "StreamSessionItem_streamSessionId_fkey"
FOREIGN KEY ("streamSessionId") REFERENCES "StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
