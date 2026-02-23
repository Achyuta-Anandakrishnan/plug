import { AuctionStatus, ListingType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDevSellerId, isDev, jsonError, jsonOk, parseJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

const allowedStatuses = new Set<string>([
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELED",
]);

type CreateAuctionBody = {
  sellerId?: string;
  categoryId?: string;
  listingType?: ListingType;
  title?: string;
  description?: string;
  startingBid?: number;
  buyNowPrice?: number;
  startTime?: string;
  endTime?: string;
  antiSnipeSeconds?: number;
  minBidIncrement?: number;
  currency?: string;
  publishNow?: boolean;
  videoStreamUrl?: string;
  item?: {
    title?: string;
    description?: string;
    condition?: string;
    attributes?: Record<string, unknown>;
    categoryId?: string;
  };
  images?: {
    url: string;
    isPrimary?: boolean;
    storageProvider?: "DATABASE" | "SUPABASE" | "S3" | "R2";
    storagePath?: string;
    width?: number;
    height?: number;
    bytes?: number;
  }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const view = searchParams.get("view");
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(searchParams.get("limit") ?? 30);

  if (statusParam && !allowedStatuses.has(statusParam)) {
    return jsonError("Invalid status filter.");
  }

  const sessionUser = await getSessionUser();
  const isAdmin = Boolean(
    sessionUser && isAdminEmail(sessionUser.email),
  );

  const now = new Date();
  await prisma.auction.updateMany({
    where: {
      status: "LIVE",
      OR: [
        { extendedTime: { not: null, lte: now } },
        { extendedTime: null, endTime: { not: null, lte: now } },
      ],
    },
    data: { status: "ENDED" },
  });

  const where: {
    status?: AuctionStatus;
    category?: { slug: string };
    seller?: { userId: string };
  } = {};

  if (statusParam) {
    where.status = statusParam as AuctionStatus;
    if (statusParam === "LIVE") {
      (where as Prisma.AuctionWhereInput).AND = [
        { OR: [{ extendedTime: { gt: now } }, { endTime: { gt: now } }, { endTime: null }] },
      ];
    }
    if (statusParam === "DRAFT") {
      if (!sessionUser) {
        return jsonError("Authentication required.", 401);
      }
      if (!isAdmin) {
        where.seller = { userId: sessionUser.id };
      }
    }
  } else {
    // Safe default: only expose live listings when no status filter is requested.
    where.status = "LIVE";
    (where as Prisma.AuctionWhereInput).AND = [
      { OR: [{ extendedTime: { gt: now } }, { endTime: { gt: now } }, { endTime: null }] },
    ];
  }

  if (category) {
    where.category = { slug: category };
  }

  if (q) {
    // Basic search across listing + item fields.
    // (No full-text index yet; good enough for MVP.)
    const query = q.slice(0, 80);
    (where as Prisma.AuctionWhereInput).OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { item: { title: { contains: query, mode: "insensitive" } } },
      { item: { description: { contains: query, mode: "insensitive" } } },
    ];
  }

  if (view === "streams") {
    (where as Prisma.AuctionWhereInput).streamSessions = {
      some: { status: "LIVE" },
    };
  }
  if (view === "listings") {
    (where as Prisma.AuctionWhereInput).streamSessions = {
      none: { status: "LIVE" },
    };
  }

  const auctions = await prisma.auction.findMany({
    where,
    include: {
      category: true,
      item: { include: { images: true } },
      seller: {
        select: {
          id: true,
          status: true,
          user: { select: { displayName: true, id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limitParam) ? Math.min(limitParam, 100) : 30,
  });

  return jsonOk(auctions);
}

export async function POST(request: Request) {
  const body = await parseJson<CreateAuctionBody>(request);

  const sessionUser = await getSessionUser();
  let sellerId: string | null = null;
  let sellerProfile = null;

  if (sessionUser) {
    sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: sessionUser.id },
    });
    if (sellerProfile) {
      sellerId = sellerProfile.id;
    } else if (isDev()) {
      sellerId = body?.sellerId || getDevSellerId();
    } else {
      return jsonError("Seller profile not found.", 403);
    }
  } else if (isDev()) {
    sellerId = body?.sellerId || getDevSellerId();
  }

  if (!sellerId && !isDev()) {
    return jsonError("Authentication required.", 401);
  }

  if (!sellerId || !body?.title) {
    return jsonError("sellerId and title are required.");
  }

  const seller =
    sellerProfile ??
    (await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    }));

  if (!seller) {
    return jsonError("Seller not found.", 404);
  }

  if (!isDev() && sessionUser && seller.status !== "APPROVED") {
    return jsonError("Seller verification pending approval.", 403);
  }

  const startTime = body.startTime ? new Date(body.startTime) : null;
  const endTime = body.endTime ? new Date(body.endTime) : null;

  if (startTime && Number.isNaN(startTime.valueOf())) {
    return jsonError("Invalid startTime.");
  }
  if (endTime && Number.isNaN(endTime.valueOf())) {
    return jsonError("Invalid endTime.");
  }

  const listingType = body.listingType ?? ListingType.AUCTION;
  const wantsAuction =
    listingType === ListingType.AUCTION || listingType === ListingType.BOTH;
  const wantsBuyNow =
    listingType === ListingType.BUY_NOW || listingType === ListingType.BOTH;

  if (wantsAuction && typeof body.startingBid !== "number") {
    return jsonError("startingBid is required for auctions.");
  }

  if (wantsBuyNow && typeof body.buyNowPrice !== "number") {
    return jsonError("buyNowPrice is required for buy-now listings.");
  }

  const now = new Date();
  let status: AuctionStatus = AuctionStatus.DRAFT;
  const publishNow = Boolean(body.publishNow);
  const effectiveStart = startTime ?? (publishNow ? now : null);

  if (effectiveStart && effectiveStart <= now) {
    status = AuctionStatus.LIVE;
  } else if (effectiveStart) {
    status = AuctionStatus.SCHEDULED;
  } else if (wantsBuyNow && publishNow) {
    status = AuctionStatus.LIVE;
  }

  const itemPayload = body.item ?? {
    title: body.title,
    description: body.description,
    categoryId: body.categoryId,
  };

  const item = await prisma.item.create({
    data: {
      sellerId,
      categoryId: itemPayload.categoryId ?? body.categoryId ?? null,
      title: itemPayload.title?.trim() || body.title.trim(),
      description: itemPayload.description?.trim() || body.description?.trim(),
      condition: itemPayload.condition,
      attributes: itemPayload.attributes as Prisma.InputJsonValue | undefined,
      images: body.images?.length
        ? {
            create: body.images.map((image) => ({
              url: image.url,
              isPrimary: Boolean(image.isPrimary),
              storageProvider: image.storageProvider ?? "DATABASE",
              storagePath: image.storagePath ?? null,
              width: image.width ?? null,
              height: image.height ?? null,
              bytes: image.bytes ?? null,
            })),
          }
        : undefined,
    },
    include: { images: true },
  });

  const auction = await prisma.auction.create({
    data: {
      sellerId,
      itemId: item.id,
      categoryId: body.categoryId ?? item.categoryId ?? null,
      title: body.title.trim(),
      description: body.description?.trim(),
      listingType,
      startingBid: wantsAuction
        ? (body.startingBid as number)
        : body.buyNowPrice ?? 0,
      currentBid: wantsAuction ? (body.startingBid as number) : 0,
      minBidIncrement: body.minBidIncrement ?? 2000,
      buyNowPrice: body.buyNowPrice ?? null,
      reservePrice: null,
      startTime: effectiveStart,
      endTime,
      antiSnipeSeconds: body.antiSnipeSeconds ?? 12,
      status,
      currency: body.currency?.toLowerCase() ?? "usd",
      videoStreamUrl: body.videoStreamUrl?.trim() || null,
    },
  });

  return jsonOk({ ...auction, item }, { status: 201 });
}
