import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Profile/account-status schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureProfileSchema() {
  return;
}

export function isProfileSchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, ["accountStatus"]);
}
