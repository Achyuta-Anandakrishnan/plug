import "server-only";

import { prisma } from "@/lib/prisma";

let ensureConversationSchemaPromise: Promise<void> | null = null;

const CONVERSATION_SCHEMA_STATEMENTS = [
  `ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
];

export async function ensureConversationSchema() {
  if (!ensureConversationSchemaPromise) {
    ensureConversationSchemaPromise = (async () => {
      for (const statement of CONVERSATION_SCHEMA_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      ensureConversationSchemaPromise = null;
      throw error;
    });
  }

  await ensureConversationSchemaPromise;
}

export function isConversationSchemaMissing(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /DirectMessage|imageUrl|column .* does not exist|relation .* does not exist/i.test(message);
}
