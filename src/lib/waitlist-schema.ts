import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Waitlist schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureWaitlistSchema() {
  return;
}

export function isWaitlistSchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, [
    /WaitlistEntry|relation .* does not exist|column .* does not exist/i,
  ]);
}
