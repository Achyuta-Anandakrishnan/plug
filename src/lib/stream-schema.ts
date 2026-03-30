import "server-only";

import { prisma } from "@/lib/prisma";

let ensureStreamSchemaPromise: Promise<void> | null = null;

const STREAM_SCHEMA_STATEMENTS = [
  `
CREATE TABLE IF NOT EXISTS "StreamSessionItem" (
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
`,
  `CREATE INDEX IF NOT EXISTS "StreamSessionItem_streamSessionId_position_idx" ON "StreamSessionItem"("streamSessionId", "position");`,
  `CREATE INDEX IF NOT EXISTS "StreamSessionItem_sourceAuctionId_idx" ON "StreamSessionItem"("sourceAuctionId");`,
  `CREATE INDEX IF NOT EXISTS "StreamSessionItem_sourceTradePostId_idx" ON "StreamSessionItem"("sourceTradePostId");`,
  `CREATE INDEX IF NOT EXISTS "StreamSessionItem_derivedAuctionId_idx" ON "StreamSessionItem"("derivedAuctionId");`,
  `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StreamSessionItem_streamSessionId_fkey'
  ) THEN
    ALTER TABLE "StreamSessionItem"
    ADD CONSTRAINT "StreamSessionItem_streamSessionId_fkey"
    FOREIGN KEY ("streamSessionId") REFERENCES "StreamSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`,
];

export async function ensureStreamSchema() {
  if (!ensureStreamSchemaPromise) {
    ensureStreamSchemaPromise = (async () => {
      for (const statement of STREAM_SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      ensureStreamSchemaPromise = null;
      throw error;
    });
  }

  await ensureStreamSchemaPromise;
}

export function isStreamSchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /StreamSessionItem|relation .* does not exist|column .* does not exist/i.test(message);
}
