import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Stream-session inventory schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureStreamSchema() {
  return;
}

export function isStreamSchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, [
    /StreamSessionItem|relation .* does not exist|column .* does not exist/i,
  ]);
}
