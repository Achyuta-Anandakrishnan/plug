import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Bounty schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureBountySchema() {
  return;
}

export function isBountySchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, [
    /WantRequest|WantRequestComment|WantRequestStatus|UserSave|column .* does not exist|relation .* does not exist/i,
  ]);
}
