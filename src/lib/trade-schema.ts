import "server-only";
import { isSchemaMissingError } from "@/lib/schema-missing";

/**
 * Trade schema is migration-owned.
 *
 * This helper remains as a compatibility shim because request handlers still
 * import it, but it must never mutate schema at request time.
 */
export async function ensureTradeSchema() {
  return;
}

export function isTradeSchemaMissing(error?: unknown) {
  return isSchemaMissingError(error, [
    /TradeOffer|TradeOfferCard|TradeSettlement|TradeDuel|TradePost|column .* does not exist|relation .* does not exist/i,
  ]);
}
