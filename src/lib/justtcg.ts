import "server-only";

type JustTcgVariant = {
  id: string;
  condition?: string | null;
  printing?: string | null;
  language?: string | null;
  price?: number | null;
  lastUpdated?: number | null;
  priceChange24hr?: number | null;
  priceChange7d?: number | null;
  avgPrice?: number | null;
  minPrice7d?: number | null;
  maxPrice7d?: number | null;
  stddevPopPrice7d?: number | null;
  covPrice7d?: number | null;
  iqrPrice7d?: number | null;
  trendSlope7d?: number | null;
  priceChangesCount7d?: number | null;
  priceChange30d?: number | null;
  avgPrice30d?: number | null;
  minPrice30d?: number | null;
  maxPrice30d?: number | null;
  stddevPopPrice30d?: number | null;
  covPrice30d?: number | null;
  iqrPrice30d?: number | null;
  trendSlope30d?: number | null;
  priceChangesCount30d?: number | null;
  priceRelativeTo30dRange?: number | null;
  priceChange90d?: number | null;
  avgPrice90d?: number | null;
  minPrice90d?: number | null;
  maxPrice90d?: number | null;
  stddevPopPrice90d?: number | null;
  covPrice90d?: number | null;
  iqrPrice90d?: number | null;
  trendSlope90d?: number | null;
  priceChangesCount90d?: number | null;
  priceRelativeTo90dRange?: number | null;
};

type JustTcgCard = {
  id: string;
  name: string;
  game: string;
  set?: string | null;
  set_name?: string | null;
  number?: string | null;
  rarity?: string | null;
  tcgplayerId?: string | null;
  variants?: JustTcgVariant[];
};

type JustTcgResponse = {
  data?: JustTcgCard[];
};

export type JustTcgMarketSnapshot = {
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
};

const JUSTTCG_BASE_URL = "https://api.justtcg.com/v1/cards";

function getJustTcgApiKey() {
  return process.env.JUSTTCG_API_KEY?.trim() ?? "";
}

function mapCategoryToGame(category?: string | null) {
  const value = (category ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("pokemon")) return "pokemon";
  if (value.includes("magic") || value.includes("mtg")) return "mtg";
  if (value.includes("yugioh") || value.includes("yu-gi-oh")) return "yugioh";
  if (value.includes("lorcana")) return "lorcana";
  if (value.includes("one piece")) return "onepiece";
  if (value.includes("dragon ball")) return "dragonballsuper";
  if (value.includes("digimon")) return "digimon";
  return null;
}

function inferGameFromName(name?: string | null) {
  const value = (name ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("pokemon") || value.includes("charizard") || value.includes("pikachu")) return "pokemon";
  if (value.includes("black lotus") || value.includes("planeswalker") || value.includes("magic")) return "mtg";
  if (value.includes("blue-eyes") || value.includes("dark magician") || value.includes("yugioh")) return "yugioh";
  if (value.includes("lorcana")) return "lorcana";
  return null;
}

function sanitizeQuery(value: string) {
  return value
    .replace(/#/g, " ")
    .replace(/\b(psa|bgs|sgc|cgc|beckett|gem|mint|nm\-mt|near mint)\b/gi, " ")
    .replace(/\b(graded|slab|holofoil|reverse holofoil|normal)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreVariant(variant: JustTcgVariant) {
  let score = 0;
  const condition = (variant.condition ?? "").toLowerCase();
  const printing = (variant.printing ?? "").toLowerCase();
  const language = (variant.language ?? "").toLowerCase();
  if (condition === "near mint") score += 5;
  else if (condition === "lightly played") score += 4;
  else if (condition === "moderately played") score += 3;
  if (language === "english") score += 2;
  if (printing === "normal") score += 2;
  else if (printing === "holofoil") score += 1;
  if ((variant.priceChangesCount30d ?? 0) > 0) score += 2;
  if ((variant.price ?? 0) > 0) score += 1;
  return score;
}

function pickBestVariant(card: JustTcgCard) {
  const variants = card.variants ?? [];
  if (!variants.length) return null;
  return [...variants].sort((a, b) => scoreVariant(b) - scoreVariant(a))[0] ?? null;
}

async function fetchJustTcgCard(query: string, game: string) {
  const key = getJustTcgApiKey();
  if (!key || !query.trim() || !game) return null;

  const url = new URL(JUSTTCG_BASE_URL);
  url.searchParams.set("game", game);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("include_price_history", "false");
  url.searchParams.set("include_statistics", "7d,30d,90d");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": key,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as JustTcgResponse;
    return payload.data?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function snapshotFromCard(
  card: JustTcgCard,
  query: string,
  matchedOn: "query" | "keyword",
): JustTcgMarketSnapshot {
  const variant = pickBestVariant(card);
  return {
    source: "justtcg",
    query,
    matchedOn,
    game: card.game,
    name: card.name,
    setName: card.set_name ?? card.set ?? null,
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    tcgplayerId: card.tcgplayerId ?? null,
    variantCount: card.variants?.length ?? 0,
    condition: variant?.condition ?? null,
    printing: variant?.printing ?? null,
    language: variant?.language ?? null,
    price: variant?.price ?? null,
    priceChange24hr: variant?.priceChange24hr ?? null,
    priceChange7d: variant?.priceChange7d ?? null,
    priceChange30d: variant?.priceChange30d ?? null,
    priceChange90d: variant?.priceChange90d ?? null,
    avgPrice7d: variant?.avgPrice ?? null,
    avgPrice30d: variant?.avgPrice30d ?? null,
    avgPrice90d: variant?.avgPrice90d ?? null,
    trendSlope7d: variant?.trendSlope7d ?? null,
    trendSlope30d: variant?.trendSlope30d ?? null,
    trendSlope90d: variant?.trendSlope90d ?? null,
    priceChangesCount7d: variant?.priceChangesCount7d ?? null,
    priceChangesCount30d: variant?.priceChangesCount30d ?? null,
    priceChangesCount90d: variant?.priceChangesCount90d ?? null,
    priceRelativeTo30dRange: variant?.priceRelativeTo30dRange ?? null,
    priceRelativeTo90dRange: variant?.priceRelativeTo90dRange ?? null,
    lastUpdated: variant?.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null,
  };
}

export async function fetchJustTcgMarketSnapshot(input: {
  itemName: string;
  category?: string | null;
  keyword?: string | null;
}) {
  const game = mapCategoryToGame(input.category) ?? inferGameFromName(input.itemName);
  if (!game) return null;

  const query = sanitizeQuery(input.itemName);
  const keyword = sanitizeQuery(input.keyword ?? "");

  if (query) {
    const card = await fetchJustTcgCard(query, game);
    if (card) return snapshotFromCard(card, query, "query");
  }

  if (keyword && keyword !== query) {
    const card = await fetchJustTcgCard(keyword, game);
    if (card) return snapshotFromCard(card, keyword, "keyword");
  }

  return null;
}
