import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { fetchJustTcgMarketSnapshot } from "@/lib/justtcg";
import { computePopScore, extractKeyword, type PopSignals } from "@/lib/pop-score";

export const runtime = "nodejs";
// Cache each score for 60 s at the CDN / browser layer
export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auctionId  = searchParams.get("auctionId")?.trim() || null;
  const rawName    = searchParams.get("itemName")?.trim()  || null;

  if (!auctionId && !rawName) {
    return jsonError("auctionId or itemName is required", 400);
  }

  // ── Resolve keyword + per-listing counters ──────────────────────────────
  let keyword      : string | null = null;
  let itemName     : string | null = rawName;
  let categoryName : string | null = null;
  let watchersCount: number        = 0;
  let savesCount   : number        = 0;

  if (auctionId) {
    const auction = await prisma.auction.findUnique({
      where : { id: auctionId },
      select: {
        title        : true,
        category     : { select: { name: true } },
        watchersCount: true,
        _count       : { select: { saves: true } },
      },
    });

    if (!auction) return jsonError("Auction not found", 404);

    itemName      = auction.title;
    categoryName  = auction.category?.name ?? null;
    keyword       = extractKeyword(auction.title);
    watchersCount = auction.watchersCount;
    savesCount    = auction._count.saves;
  } else {
    keyword = extractKeyword(rawName!);
  }

  // Not enough signal from the title → return neutral score immediately
  if (!keyword) {
    return jsonOk({
      popScore   : 45,
      label      : "Active",
      explanation: "Not enough market data yet",
      demand     : 0,
      supply     : 0,
    });
  }

  // ── Time windows ────────────────────────────────────────────────────────
  const now = new Date();
  const h24 = new Date(now.getTime() - 1    * 24 * 3_600_000);
  const d7  = new Date(now.getTime() - 7    * 24 * 3_600_000);
  const d30 = new Date(now.getTime() - 30   * 24 * 3_600_000);
  const d90 = new Date(now.getTime() - 90   * 24 * 3_600_000);

  const titleFilter   = { contains: keyword, mode: "insensitive" as const };
  const excludeCurrent = auctionId ? { id: { not: auctionId } } : {};

  // ── Parallel DB queries ─────────────────────────────────────────────────
  const [
    activeListings,
    activeTradePosts,
    bounties_24h,
    bounties_7d,
    bounties_older,
    bids_24h,
    bids_7d,
    tradeOffers,
    recentSales_7d,
    recentSales_30d,
  ] = await Promise.all([

    // Supply — LIVE / SCHEDULED auctions for the same item (excluding self)
    prisma.auction.count({
      where: {
        ...excludeCurrent,
        status: { in: ["LIVE", "SCHEDULED"] },
        title : titleFilter,
      },
    }),

    // Supply — OPEN trade posts mentioning the same item
    prisma.tradePost.count({
      where: { status: "OPEN", title: titleFilter },
    }),

    // Demand — bounties opened in the last 24 h
    prisma.wantRequest.count({
      where: {
        status   : "OPEN",
        createdAt: { gte: h24 },
        OR: [{ itemName: titleFilter }, { title: titleFilter }],
      },
    }),

    // Demand — bounties opened 1–7 days ago
    prisma.wantRequest.count({
      where: {
        status   : "OPEN",
        createdAt: { gte: d7, lt: h24 },
        OR: [{ itemName: titleFilter }, { title: titleFilter }],
      },
    }),

    // Demand — bounties opened 7–90 days ago (still open = persistent want)
    prisma.wantRequest.count({
      where: {
        status   : "OPEN",
        createdAt: { gte: d90, lt: d7 },
        OR: [{ itemName: titleFilter }, { title: titleFilter }],
      },
    }),

    // Velocity — bids on this auction in the last 24 h
    auctionId
      ? prisma.bid.count({
          where: {
            auctionId,
            createdAt: { gte: h24 },
            status   : { not: "RETRACTED" },
          },
        })
      : Promise.resolve(0),

    // Velocity — bids on this auction 1–7 days ago
    auctionId
      ? prisma.bid.count({
          where: {
            auctionId,
            createdAt: { gte: d7, lt: h24 },
            status   : { not: "RETRACTED" },
          },
        })
      : Promise.resolve(0),

    // Demand — pending trade offers on matching posts
    prisma.tradeOffer.count({
      where: {
        status: "PENDING",
        post  : { status: "OPEN", title: titleFilter },
      },
    }),

    // Velocity — completed sales for this item in the last 7 days
    prisma.order.count({
      where: {
        status   : { in: ["PAID", "FULFILLING", "DELIVERED", "CONFIRMED"] },
        createdAt: { gte: d7 },
        auction  : { title: titleFilter },
      },
    }),

    // Velocity — completed sales 8–30 days ago
    prisma.order.count({
      where: {
        status   : { in: ["PAID", "FULFILLING", "DELIVERED", "CONFIRMED"] },
        createdAt: { gte: d30, lt: d7 },
        auction  : { title: titleFilter },
      },
    }),
  ]);

  const externalMarket = itemName
    ? await fetchJustTcgMarketSnapshot({
        itemName,
        category: categoryName,
        keyword,
      })
    : null;

  const externalMomentum =
    externalMarket
      ? Math.max(0, externalMarket.priceChange7d ?? 0) * 0.2
        + Math.max(0, externalMarket.priceChange30d ?? 0) * 0.08
        + Math.max(0, externalMarket.trendSlope30d ?? 0) * 10
      : 0;

  const externalLiquidity =
    externalMarket
      ? (externalMarket.priceChangesCount7d ?? 0) * 0.5
        + (externalMarket.priceChangesCount30d ?? 0) * 0.25
      : 0;

  const signals: PopSignals = {
    activeListings,
    activeTradePosts,
    watchersCount,
    savesCount,
    tradeOffers,
    bounties_24h,
    bounties_7d,
    bounties_older,
    bids_24h,
    bids_7d,
    recentSales_7d,
    recentSales_30d,
    externalMomentum,
    externalLiquidity,
  };

  const result = computePopScore(signals);
  result.marketData = externalMarket;

  return jsonOk(result, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
  });
}
