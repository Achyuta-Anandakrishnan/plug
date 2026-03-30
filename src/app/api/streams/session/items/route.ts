import { ListingType, StreamProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { isStreamSchemaMissing } from "@/lib/stream-schema";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { tradeValueLabel } from "@/lib/trade-client";
import { getCanonicalSellerReadiness, getSellerCapabilityError } from "@/lib/seller-onboarding";

type StreamQueueBody = {
  auctionId?: string;
  sourceType?: "AUCTION" | "TRADE_POST";
  sourceId?: string;
  action?: "REMOVE";
  queueItemId?: string;
};

function auctionPriceLabel(auction: {
  listingType: "AUCTION" | "BUY_NOW" | "BOTH";
  currentBid: number;
  buyNowPrice: number | null;
  currency?: string | null;
}) {
  const currency = auction.currency?.toUpperCase() || "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  if (auction.listingType === "BUY_NOW" && typeof auction.buyNowPrice === "number") {
    return `Buy now ${formatter.format(auction.buyNowPrice / 100)}`;
  }
  if (auction.listingType === "BOTH" && typeof auction.buyNowPrice === "number") {
    return `Bid ${formatter.format(auction.currentBid / 100)} · Buy ${formatter.format(auction.buyNowPrice / 100)}`;
  }
  return `Bid ${formatter.format(auction.currentBid / 100)}`;
}

function getNextStartingBid(valueMin: number | null, valueMax: number | null) {
  const preferred = valueMin ?? valueMax ?? 5000;
  const startingBid = Math.max(1000, preferred);
  const minBidIncrement = Math.max(500, Math.min(2500, Math.round(startingBid * 0.05)));
  const currentBid = Math.max(0, startingBid - minBidIncrement);
  return { startingBid, minBidIncrement, currentBid };
}

async function loadStreamAuctionForHost(auctionId: string, userId: string, email?: string | null) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { seller: true },
  });

  if (!auction) return { error: jsonError("Listing not found.", 404) };
  const isAdmin = isAdminEmail(email);
  if (auction.seller.userId !== userId && !isAdmin) {
    return { error: jsonError("Not authorized to manage this stream.", 403) };
  }
  if (auction.seller.userId === userId) {
    const readiness = await getCanonicalSellerReadiness(auction.seller);
    const sellerGateError = getSellerCapabilityError(readiness, "stream");
    if (sellerGateError) {
      return { error: jsonError(sellerGateError, 403) };
    }
  }

  return { auction };
}

async function ensureSessionForAuction(auctionId: string) {
  let session = await prisma.streamSession.findFirst({
    where: {
      auctionId,
      provider: StreamProvider.LIVEKIT,
      status: { in: ["CREATED", "LIVE"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    session = await prisma.streamSession.create({
      data: {
        auctionId,
        provider: StreamProvider.LIVEKIT,
        status: "CREATED",
        roomName: `auction-${auctionId}`,
      },
    });
  }

  return session;
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const { searchParams } = new URL(request.url);
    const auctionId = (searchParams.get("auctionId") ?? "").trim();
    if (!auctionId) {
      return jsonError("auctionId is required.", 400);
    }

    const loaded = await loadStreamAuctionForHost(auctionId, sessionUser.id, sessionUser.email);
    if ("error" in loaded) return loaded.error;

    const session = await prisma.streamSession.findFirst({
      where: { auctionId, provider: StreamProvider.LIVEKIT },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          where: { status: { not: "REMOVED" } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    const candidateAuctions = await prisma.auction.findMany({
      where: {
        sellerId: loaded.auction.sellerId,
        id: { not: auctionId },
        status: { in: ["DRAFT", "SCHEDULED", "LIVE"] },
      },
      include: {
        item: {
          include: {
            images: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
            },
          },
        },
        category: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 16,
    });

    const candidateTrades = await prisma.tradePost.findMany({
      where: {
        ownerId: sessionUser.id,
        status: { in: ["OPEN", "PAUSED"] },
      },
      include: {
        images: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 16,
    });

    return jsonOk({
      sessionId: session?.id ?? null,
      queue: (session?.items ?? []).map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        sourceId: item.sourceType === "TRADE_POST" ? item.sourceTradePostId : item.sourceAuctionId,
        linkedAuctionId: item.derivedAuctionId ?? item.sourceAuctionId,
        title: item.title,
        subtitle: item.subtitle,
        imageUrl: item.imageUrl,
        priceLabel: item.priceLabel,
        status: item.status,
        href: item.derivedAuctionId
          ? `/streams/${item.derivedAuctionId}`
          : item.sourceAuctionId
            ? `/streams/${item.sourceAuctionId}`
            : null,
      })),
      candidates: {
        auctions: candidateAuctions.map((entry) => ({
          id: entry.id,
          title: entry.title,
          subtitle: [entry.category?.name, entry.listingType.replaceAll("_", " ")].filter(Boolean).join(" · "),
          imageUrl: entry.item?.images?.[0]?.url ?? null,
          priceLabel: auctionPriceLabel(entry),
        })),
        trades: candidateTrades.map((entry) => ({
          id: entry.id,
          title: entry.title,
          subtitle: [entry.category, entry.lookingFor].filter(Boolean).join(" · "),
          imageUrl: entry.images[0]?.url ?? null,
          priceLabel: tradeValueLabel(entry.valueMin, entry.valueMax),
        })),
      },
    });
  } catch (error) {
    if (isStreamSchemaMissing(error)) {
      return jsonError("Stream inventory is initializing. Retry in a few seconds.", 503);
    }
    console.error("Stream inventory GET failed", { error });
    return jsonError("Unable to load stream inventory right now.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return jsonError("Authentication required.", 401);
    }

    const body = await parseJson<StreamQueueBody>(request);
    const auctionId = body?.auctionId?.trim() ?? "";
    if (!auctionId) {
      return jsonError("auctionId is required.", 400);
    }

    const loaded = await loadStreamAuctionForHost(auctionId, sessionUser.id, sessionUser.email);
    if ("error" in loaded) return loaded.error;

    const session = await ensureSessionForAuction(auctionId);

    if (body?.action === "REMOVE") {
      const queueItemId = body.queueItemId?.trim() ?? "";
      if (!queueItemId) {
        return jsonError("queueItemId is required.", 400);
      }
      const queueItem = await prisma.streamSessionItem.findUnique({
        where: { id: queueItemId },
      });
      if (!queueItem || queueItem.streamSessionId !== session.id) {
        return jsonError("Queued item not found.", 404);
      }

      await prisma.$transaction(async (tx) => {
        await tx.streamSessionItem.update({
          where: { id: queueItemId },
          data: { status: "REMOVED" },
        });

        if (queueItem.sourceType === "TRADE_POST" && queueItem.derivedAuctionId) {
          await tx.auction.updateMany({
            where: {
              id: queueItem.derivedAuctionId,
              status: { in: ["DRAFT", "SCHEDULED"] },
            },
            data: { status: "CANCELED" },
          });
        }
      });
      return jsonOk({ removed: true });
    }

    const sourceType = body?.sourceType;
    const sourceId = body?.sourceId?.trim() ?? "";
    if (!sourceType || !sourceId) {
      return jsonError("sourceType and sourceId are required.", 400);
    }

    const currentCount = await prisma.streamSessionItem.count({
      where: { streamSessionId: session.id, status: { not: "REMOVED" } },
    });

    if (sourceType === "AUCTION") {
      const sourceAuction = await prisma.auction.findFirst({
        where: {
          id: sourceId,
          sellerId: loaded.auction.sellerId,
          status: { in: ["DRAFT", "SCHEDULED", "LIVE"] },
        },
        include: {
          item: {
            include: {
              images: {
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                take: 1,
              },
            },
          },
          category: { select: { name: true } },
        },
      });

      if (!sourceAuction) {
        return jsonError("Listing not found.", 404);
      }

      const existing = await prisma.streamSessionItem.findFirst({
        where: {
          streamSessionId: session.id,
          sourceAuctionId: sourceAuction.id,
          status: { not: "REMOVED" },
        },
      });
      if (existing) {
        return jsonOk({ id: existing.id, duplicate: true });
      }

      if (sourceAuction.listingType === ListingType.BUY_NOW) {
        await prisma.auction.update({
          where: { id: sourceAuction.id },
          data: { listingType: ListingType.BOTH },
        });
      }
      const queueListingType = sourceAuction.listingType === ListingType.BUY_NOW
        ? ListingType.BOTH
        : sourceAuction.listingType;

      const created = await prisma.streamSessionItem.create({
        data: {
          streamSessionId: session.id,
          sourceType: "AUCTION",
          sourceAuctionId: sourceAuction.id,
          title: sourceAuction.title,
          subtitle: [sourceAuction.category?.name, queueListingType.replaceAll("_", " ")].filter(Boolean).join(" · ") || "Listing",
          imageUrl: sourceAuction.item?.images?.[0]?.url ?? null,
          priceLabel: auctionPriceLabel({
            ...sourceAuction,
            listingType: queueListingType,
          }),
          position: currentCount,
        },
      });

      return jsonOk({
        id: created.id,
        href: `/streams/${sourceAuction.id}`,
      }, { status: 201 });
    }

    if (sourceType === "TRADE_POST") {
      const trade = await prisma.tradePost.findFirst({
        where: {
          id: sourceId,
          ownerId: sessionUser.id,
          status: { in: ["OPEN", "PAUSED"] },
        },
        include: {
          images: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
      });

      if (!trade) {
        return jsonError("Trade inventory not found.", 404);
      }

      const existing = await prisma.streamSessionItem.findFirst({
        where: {
          streamSessionId: session.id,
          sourceTradePostId: trade.id,
          status: { not: "REMOVED" },
        },
      });
      if (existing) {
        return jsonOk({ id: existing.id, duplicate: true, href: existing.derivedAuctionId ? `/streams/${existing.derivedAuctionId}` : null });
      }

      const category = trade.category
        ? await prisma.category.findFirst({
            where: { name: { equals: trade.category, mode: "insensitive" } },
            select: { id: true },
          })
        : null;

      const { startingBid, minBidIncrement, currentBid } = getNextStartingBid(trade.valueMin, trade.valueMax);
      const derivedAuction = await prisma.$transaction(async (tx) => {
        const item = await tx.item.create({
          data: {
            sellerId: loaded.auction.sellerId,
            categoryId: category?.id ?? null,
            title: trade.title,
            description: trade.description,
            condition: trade.condition,
            attributes: {
              sourceTradePostId: trade.id,
              gradeCompany: trade.gradeCompany,
              gradeLabel: trade.gradeLabel,
              cardSet: trade.cardSet,
              cardNumber: trade.cardNumber,
            },
          },
        });

        if (trade.images.length > 0) {
          await tx.itemImage.createMany({
            data: trade.images.map((image, index) => ({
              itemId: item.id,
              url: image.url,
              isPrimary: image.isPrimary || index === 0,
            })),
          });
        }

        return tx.auction.create({
          data: {
            sellerId: loaded.auction.sellerId,
            itemId: item.id,
            categoryId: category?.id ?? null,
            title: trade.title,
            description: trade.description,
            listingType: ListingType.AUCTION,
            status: "DRAFT",
            startingBid,
            currentBid,
            minBidIncrement,
            currency: "usd",
          },
        });
      });

      const created = await prisma.streamSessionItem.create({
        data: {
          streamSessionId: session.id,
          sourceType: "TRADE_POST",
          sourceTradePostId: trade.id,
          derivedAuctionId: derivedAuction.id,
          title: trade.title,
          subtitle: [trade.category, "Trade inventory"].filter(Boolean).join(" · ") || "Trade inventory",
          imageUrl: trade.images[0]?.url ?? null,
          priceLabel: tradeValueLabel(trade.valueMin, trade.valueMax),
          position: currentCount,
        },
      });

      return jsonOk({
        id: created.id,
        href: `/streams/${derivedAuction.id}`,
      }, { status: 201 });
    }

    return jsonError("Unsupported sourceType.", 400);
  } catch (error) {
    if (isStreamSchemaMissing(error)) {
      return jsonError("Stream inventory is initializing. Retry in a few seconds.", 503);
    }
    console.error("Stream inventory POST failed", { error });
    return jsonError("Unable to update stream inventory right now.", 500);
  }
}
