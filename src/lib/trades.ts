export const TRADE_POST_STATUSES = ["OPEN", "PAUSED", "MATCHED", "CLOSED", "ARCHIVED"] as const;
export const TRADE_OFFER_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN", "COUNTERED"] as const;
export const TRADE_GAME_TYPES = ["checkers", "chess", "coin", "poker"] as const;
export const TRADE_DUEL_TYPES = TRADE_GAME_TYPES;
export const TRADE_DUEL_STATUSES = ["PENDING", "READY", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELED", "EXPIRED"] as const;
export const TRADE_SETTLEMENT_STATUSES = [
  "REQUIRES_PAYMENT",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export type TradePostStatus = (typeof TRADE_POST_STATUSES)[number];
export type TradeOfferStatus = (typeof TRADE_OFFER_STATUSES)[number];
export type TradeGameType = (typeof TRADE_GAME_TYPES)[number];
export type TradeDuelType = (typeof TRADE_DUEL_TYPES)[number];
export type TradeDuelStatus = (typeof TRADE_DUEL_STATUSES)[number];
export type TradeSettlementStatus = (typeof TRADE_SETTLEMENT_STATUSES)[number];

export function isTradePostStatus(value: unknown): value is TradePostStatus {
  return typeof value === "string" && TRADE_POST_STATUSES.includes(value as TradePostStatus);
}

export function isTradeOfferStatus(value: unknown): value is TradeOfferStatus {
  return typeof value === "string" && TRADE_OFFER_STATUSES.includes(value as TradeOfferStatus);
}

export function isTradeGameType(value: unknown): value is TradeGameType {
  return typeof value === "string" && TRADE_GAME_TYPES.includes(value as TradeGameType);
}

export const isTradeDuelType = isTradeGameType;

export function isTradeDuelStatus(value: unknown): value is TradeDuelStatus {
  return typeof value === "string" && TRADE_DUEL_STATUSES.includes(value as TradeDuelStatus);
}

export function isTradeSettlementStatus(value: unknown): value is TradeSettlementStatus {
  return typeof value === "string" && TRADE_SETTLEMENT_STATUSES.includes(value as TradeSettlementStatus);
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

export function toHttpUrlOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
