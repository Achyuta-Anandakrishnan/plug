import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Conversation/message schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureConversationSchema() {
  return;
}

export function isConversationSchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, [
    /DirectMessage|imageUrl|column .* does not exist|relation .* does not exist/i,
  ]);
}
