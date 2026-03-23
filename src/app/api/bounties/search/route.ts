import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { ensureBountySchema, isBountySchemaMissing } from "@/lib/bounty-schema";
import { type BountySearchSuggestion } from "@/lib/bounties";

function getSearchParams(request: Request) {
  try {
    return new URL(request.url).searchParams;
  } catch {
    return new URL(request.url, "http://localhost").searchParams;
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function buildCachedCardTitle(record: Record<string, Prisma.JsonValue>, certNumber: string) {
  const directTitle = clean(record.title);
  if (directTitle) return directTitle;
  const parts = [
    clean(record.year),
    clean(record.brand) || clean(record.set),
    clean(record.cardNumber) ? `#${clean(record.cardNumber)}` : "",
    clean(record.player) || clean(record.subject),
    clean(record.variety),
  ].filter(Boolean);
  return parts.join(" ") || `Cert ${certNumber}`;
}

function getCachedImage(record: Record<string, Prisma.JsonValue>) {
  const direct = clean(record.imageUrl);
  if (direct) return direct;
  const list = Array.isArray(record.imageUrls) ? record.imageUrls : [];
  const first = list.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  if (first) return first;
  const images = record.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const front = clean((images as Record<string, Prisma.JsonValue>).front);
    if (front) return front;
  }
  return null;
}

function dedupeSuggestions(entries: BountySearchSuggestion[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.source}:${entry.title.toLowerCase()}:${entry.certNumber ?? ""}:${entry.itemName.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: Request) {
  await ensureBountySchema().catch(() => null);
  try {
    const searchParams = getSearchParams(request);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 8), 1), 12);

    if (q.length < 2) {
      return jsonOk([]);
    }

    const [auctions, trades, bounties, cachedCards] = await Promise.all([
      prisma.auction.findMany({
        where: {
          status: { in: ["SCHEDULED", "LIVE", "ENDED"] },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { item: { is: { title: { contains: q, mode: "insensitive" } } } },
          ],
        },
        include: {
          category: { select: { name: true } },
          item: {
            select: {
              title: true,
              attributes: true,
              images: {
                where: { isPrimary: true },
                select: { url: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      prisma.tradePost.findMany({
        where: {
          status: { in: ["OPEN", "MATCHED", "PAUSED"] },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { cardSet: { contains: q, mode: "insensitive" } },
            { cardNumber: { contains: q, mode: "insensitive" } },
            { gradeCompany: { contains: q, mode: "insensitive" } },
            { gradeLabel: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      prisma.wantRequest.findMany({
        where: {
          status: "OPEN",
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { itemName: { contains: q, mode: "insensitive" } },
            { player: { contains: q, mode: "insensitive" } },
            { setName: { contains: q, mode: "insensitive" } },
            { year: { contains: q, mode: "insensitive" } },
            { certNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      /^[0-9]{4,}$/.test(q)
        ? prisma.verifiedCardCache.findMany({
            where: {
              certNumber: { contains: q, mode: "insensitive" },
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

  const auctionSuggestions: BountySearchSuggestion[] = auctions.map((auction) => {
    const attributes = asRecord(auction.item?.attributes);
    return {
      id: `auction:${auction.id}`,
      source: "listing",
      title: clean(auction.title) || clean(auction.item?.title) || "Listing",
      subtitle: [clean(auction.category?.name), clean(auction.listingType).replaceAll("_", " ")].filter(Boolean).join(" • ") || "Listing",
      imageUrl: auction.item?.images[0]?.url ?? null,
      category: clean(auction.category?.name) || null,
      itemName: clean(auction.title) || clean(auction.item?.title) || "Listing",
      player: clean(attributes.player) || clean(attributes.subject) || null,
      setName: clean(attributes.set) || clean(attributes.brand) || null,
      year: clean(attributes.year) || null,
      gradeCompany: clean(attributes.gradingCompany) || null,
      gradeTarget: clean(attributes.gradingLabel) || clean(attributes.grade) || null,
      certNumber: clean(attributes.certNumber) || null,
    };
  });

  const tradeSuggestions: BountySearchSuggestion[] = trades.map((trade) => ({
    id: `trade:${trade.id}`,
    source: "trade",
    title: trade.title,
    subtitle: [trade.cardSet, trade.gradeCompany, trade.gradeLabel].filter(Boolean).join(" • ") || "Trade post",
    imageUrl: trade.images[0]?.url ?? null,
    category: trade.category,
    itemName: trade.title,
    player: null,
    setName: trade.cardSet,
    year: null,
    gradeCompany: trade.gradeCompany,
    gradeTarget: trade.gradeLabel,
    certNumber: null,
  }));

  const bountySuggestions: BountySearchSuggestion[] = bounties.map((bounty) => ({
    id: `bounty:${bounty.id}`,
    source: "bounty",
    title: bounty.title,
    subtitle: [bounty.category, bounty.gradeCompany, bounty.gradeTarget || bounty.grade].filter(Boolean).join(" • ") || "Existing bounty",
    imageUrl: bounty.imageUrl,
    category: bounty.category,
    itemName: bounty.itemName,
    player: bounty.player,
    setName: bounty.setName,
    year: bounty.year,
    gradeCompany: bounty.gradeCompany,
    gradeTarget: bounty.gradeTarget || bounty.grade,
    certNumber: bounty.certNumber,
  }));

  const cachedSuggestions: BountySearchSuggestion[] = cachedCards.map((card) => {
    const normalized = asRecord(card.normalized);
    return {
      id: `cert:${card.grader}:${card.certNumber}`,
      source: "cert",
      title: buildCachedCardTitle(normalized, card.certNumber),
      subtitle: [clean(normalized.grader) || card.grader, clean(normalized.grade) || clean(normalized.label), `Cert ${card.certNumber}`]
        .filter(Boolean)
        .join(" • "),
      imageUrl: getCachedImage(normalized),
      category: clean(normalized.category) || null,
      itemName: buildCachedCardTitle(normalized, card.certNumber),
      player: clean(normalized.player) || clean(normalized.subject) || null,
      setName: clean(normalized.set) || clean(normalized.brand) || null,
      year: clean(normalized.year) || null,
      gradeCompany: clean(normalized.grader) || card.grader,
      gradeTarget: clean(normalized.label) || clean(normalized.grade) || null,
      certNumber: card.certNumber,
    };
  });

    return jsonOk(dedupeSuggestions([
      ...cachedSuggestions,
      ...auctionSuggestions,
      ...tradeSuggestions,
      ...bountySuggestions,
    ]).slice(0, limit));
  } catch (error) {
    if (isBountySchemaMissing(error)) {
      await ensureBountySchema().catch(() => null);
      return jsonOk([]);
    }
    console.error("Bounty search failed", { error });
    return jsonOk([]);
  }
}
