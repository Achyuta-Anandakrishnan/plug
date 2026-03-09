export const TRADE_POST_STATUSES = ["OPEN", "PAUSED", "MATCHED", "CLOSED", "ARCHIVED"] as const;
export const TRADE_OFFER_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN", "COUNTERED"] as const;

export type TradePostStatus = (typeof TRADE_POST_STATUSES)[number];
export type TradeOfferStatus = (typeof TRADE_OFFER_STATUSES)[number];

export function isTradePostStatus(value: unknown): value is TradePostStatus {
  return typeof value === "string" && TRADE_POST_STATUSES.includes(value as TradePostStatus);
}

export function isTradeOfferStatus(value: unknown): value is TradeOfferStatus {
  return typeof value === "string" && TRADE_OFFER_STATUSES.includes(value as TradeOfferStatus);
}

export function parseIntOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

export function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 24);
}
