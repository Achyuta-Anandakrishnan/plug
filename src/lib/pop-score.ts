// POP Score — Market Scarcity Score
// Measures how difficult an item is to acquire based on real-time supply/demand signals.
// Score 0–100: 0–20 Common | 20–40 Active | 40–60 Scarce | 60–80 Hot | 80–100 Elite

// ─── Weight constants ────────────────────────────────────────────────────────

const W_BOUNTIES = 3;
const W_WATCHERS = 1;
const W_SAVES    = 1.5;
const W_OFFERS   = 2;
const W_BIDS     = 2;
const W_LISTINGS = 2;
const W_TRADES   = 1;

// Recency decay
const DECAY_24H = 1.0;
const DECAY_7D  = 0.7;
const DECAY_OLD = 0.4;

// ln(ratio) is mapped to 0–100 where ratio=1 → score=50.
// MAX_LOG_SCALE is the ln(ratio) that yields ±50 (i.e. score 0 or 100).
// ln(33) ≈ 3.5 — a 33× demand/supply ratio maps to ~100.
const MAX_LOG_SCALE = 3.5;

// Below this total signal count the data is too sparse; return neutral.
const SPARSE_THRESHOLD = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

export type PopSignals = {
  // Supply
  activeListings: number;    // LIVE / SCHEDULED auctions for the same item
  activeTradePosts: number;  // OPEN trade posts for the same item

  // Demand — point-in-time
  watchersCount: number;
  savesCount: number;
  tradeOffers: number;       // PENDING offers on matching trade posts

  // Demand — time-bucketed
  bounties_24h: number;
  bounties_7d: number;
  bounties_older: number;

  bids_24h: number;
  bids_7d: number;

  // Velocity
  recentSales_7d: number;
  recentSales_30d: number;

  // External market signal
  externalMomentum?: number;
  externalLiquidity?: number;
};

export type PopScoreLabel = "Common" | "Active" | "Scarce" | "Hot" | "Elite";

export type PopScoreResult = {
  popScore: number;
  label: PopScoreLabel;
  explanation: string;
  demand: number;
  supply: number;
  marketData?: {
    source: "justtcg";
    query: string;
    matchedOn: "query" | "keyword";
    game: string;
    name: string;
    setName: string | null;
    number: string | null;
    rarity: string | null;
    tcgplayerId: string | null;
    variantCount: number;
    condition: string | null;
    printing: string | null;
    language: string | null;
    price: number | null;
    priceChange24hr: number | null;
    priceChange7d: number | null;
    priceChange30d: number | null;
    priceChange90d: number | null;
    avgPrice7d: number | null;
    avgPrice30d: number | null;
    avgPrice90d: number | null;
    trendSlope7d: number | null;
    trendSlope30d: number | null;
    trendSlope90d: number | null;
    priceChangesCount7d: number | null;
    priceChangesCount30d: number | null;
    priceChangesCount90d: number | null;
    priceRelativeTo30dRange: number | null;
    priceRelativeTo90dRange: number | null;
    lastUpdated: string | null;
  } | null;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

function totalSignalCount(s: PopSignals): number {
  return (
    s.activeListings + s.activeTradePosts +
    s.watchersCount  + s.savesCount + s.tradeOffers +
    s.bounties_24h   + s.bounties_7d + s.bounties_older +
    s.bids_24h       + s.bids_7d +
    s.recentSales_7d + s.recentSales_30d +
    (s.externalMomentum ?? 0) + (s.externalLiquidity ?? 0)
  );
}

function weightedDemand(s: PopSignals): number {
  const bountySignal =
    (s.bounties_24h * DECAY_24H + s.bounties_7d * DECAY_7D + s.bounties_older * DECAY_OLD) *
    W_BOUNTIES;

  const bidSignal =
    (s.bids_24h * DECAY_24H + s.bids_7d * DECAY_7D) * W_BIDS;

  const staticSignal =
    s.watchersCount * W_WATCHERS +
    s.savesCount    * W_SAVES    +
    s.tradeOffers   * W_OFFERS;

  return bountySignal + bidSignal + staticSignal + (s.externalMomentum ?? 0);
}

function weightedSupply(s: PopSignals): number {
  return s.activeListings   * W_LISTINGS +
         s.activeTradePosts * W_TRADES;
}

function velocityMultiplier(s: PopSignals): number {
  const bidEngagement   = s.bids_24h * DECAY_24H + s.bids_7d * DECAY_7D;
  const salesEngagement = s.recentSales_7d + s.recentSales_30d * DECAY_OLD;
  const total = bidEngagement + salesEngagement * 2 + (s.externalLiquidity ?? 0);

  if (total >= 10) return 1.5;
  if (total >=  5) return 1.3;
  if (total >=  2) return 1.15;
  if (total >=  1) return 1.0;
  // Dead market with supply present → suppress score
  if (s.activeListings > 0 || s.activeTradePosts > 0) return 0.85;
  return 0.7;
}

function toLabel(score: number): PopScoreLabel {
  if (score >= 80) return "Elite";
  if (score >= 60) return "Hot";
  if (score >= 40) return "Scarce";
  if (score >= 20) return "Active";
  return "Common";
}

function buildExplanation(
  s: PopSignals,
  demand: number,
  supply: number,
  score: number,
): string {
  const totalBounties = s.bounties_24h + s.bounties_7d + s.bounties_older;
  const totalBids     = s.bids_24h + s.bids_7d;

  if (score >= 80) {
    if (totalBounties > 0 && s.activeListings === 0) return "High demand, no active listings";
    if (totalBids >= 5) return "Very active bidding with limited supply";
    return "Extremely high demand and scarce availability";
  }
  if (score >= 60) {
    if (totalBounties >= 2) return "Multiple active bounties for this item";
    if (totalBids > 0)      return "Active bidding with moderate supply";
    return "High demand with limited active listings";
  }
  if (score >= 40) {
    if (supply > demand) return "Available in market with some demand";
    return "Balanced supply and demand";
  }
  if (score >= 20) {
    if (s.activeListings >= 3) return "Several active listings available";
    return "Moderate availability in the market";
  }
  return "Readily available with low demand";
}

// ─── Keyword extraction ──────────────────────────────────────────────────────

const GENERIC_WORDS = new Set([
  "card", "cards", "item", "items", "sports", "trading", "collectible",
  "memorabilia", "mint", "near", "good", "poor", "fair", "very", "pack",
  "packs", "auto", "signed", "serial", "numbered", "rookie", "base",
]);

/**
 * Extracts the single most-discriminating keyword from a listing title.
 * Longer words (e.g. player names, set names) are preferred over short ones.
 * Pure numbers (years, grades) and generic collector terms are filtered out.
 */
export function extractKeyword(title: string): string | null {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^\d+$/.test(w) && !GENERIC_WORDS.has(w));

  if (words.length === 0) return null;

  // Sort by length descending — longer words are typically more specific
  words.sort((a, b) => b.length - a.length);
  return words[0] ?? null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function computePopScore(signals: PopSignals): PopScoreResult {
  if (totalSignalCount(signals) < SPARSE_THRESHOLD) {
    return {
      popScore: 45,
      label: "Active",
      explanation: "Not enough market data yet",
      demand: 0,
      supply: 0,
      marketData: null,
    };
  }

  const demand = weightedDemand(signals);
  const supply = weightedSupply(signals);

  // demand+1 / supply+1 smoothing prevents division by zero and avoids
  // extreme values when one side is zero.
  const baseRatio = (demand + 1) / (supply + 1);
  const logScore  = Math.log(baseRatio); // natural log; 0 when balanced
  const velocity  = velocityMultiplier(signals);
  const scaled    = logScore * velocity;

  // Map: ln(ratio)=0 → score=50; negative → lower; positive → higher
  const raw      = 50 + (scaled / MAX_LOG_SCALE) * 50;
  const popScore = Math.round(Math.min(100, Math.max(0, raw)));

  return {
    popScore,
    label: toLabel(popScore),
    explanation: buildExplanation(signals, demand, supply, popScore),
    demand: Math.round(demand * 100) / 100,
    supply: Math.round(supply * 100) / 100,
    marketData: null,
  };
}
