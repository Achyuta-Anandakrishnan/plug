import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isTradeGameType, isTradeOfferStatus, parseIntOrNull } from "@/lib/trades";
import { ensureTradeSchema } from "@/lib/trade-schema";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

type UpdateOfferBody = {
  status?: string;
  message?: string;
  cashAdjustment?: number | string | null;
  counterMode?: "STANDARD" | "GAME";
  gameType?: string | null;
  gameTerms?: string | null;
  gameAction?: "AGREE_TERMS" | "START_GAME" | "RESOLVE_GAME";
  gameWinnerId?: string | null;
};

const offerInclude = {
  proposer: {
    select: {
      id: true,
      username: true,
      displayName: true,
      image: true,
    },
  },
  cards: {
    orderBy: { createdAt: "asc" },
  },
  settlement: {
    include: {
      payer: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      payee: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  },
} as const;

function normalizeGameType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!isTradeGameType(normalized)) return null;
  return normalized;
}

function normalizeGameTerms(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  const { offerId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<UpdateOfferBody>(request);
  if (!body?.status && !body?.gameAction) {
    return jsonError("Invalid offer update payload.");
  }

  if (body?.status && !isTradeOfferStatus(body.status)) {
    return jsonError("Invalid offer status.");
  }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: {
      post: {
        select: {
          id: true,
          ownerId: true,
          status: true,
        },
      },
      settlement: true,
    },
  });

  if (!offer) {
    return jsonError("Offer not found.", 404);
  }

  const isOwner = offer.post.ownerId === sessionUser.id;
  const isProposer = offer.proposerId === sessionUser.id;
  if (!isOwner && !isProposer) {
    return jsonError("Not authorized to update this offer.", 403);
  }

  if (body.gameAction === "AGREE_TERMS") {
    if (offer.status !== "COUNTERED") {
      return jsonError("Game terms can only be agreed on countered offers.", 409);
    }
    if (!offer.gameType || !offer.gameTerms) {
      return jsonError("No game terms are attached to this counter offer.", 409);
    }

    const now = new Date();
    const nextOwnerAgreedAt = isOwner
      ? (offer.gameOwnerAgreedAt ?? now)
      : offer.gameOwnerAgreedAt;
    const nextProposerAgreedAt = isProposer
      ? (offer.gameProposerAgreedAt ?? now)
      : offer.gameProposerAgreedAt;

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        gameOwnerAgreedAt: nextOwnerAgreedAt,
        gameProposerAgreedAt: nextProposerAgreedAt,
        gameLockedAt: nextOwnerAgreedAt && nextProposerAgreedAt
          ? (offer.gameLockedAt ?? now)
          : null,
      },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  if (body.gameAction === "START_GAME") {
    if (offer.status !== "COUNTERED") {
      return jsonError("Game sessions can only start on countered offers.", 409);
    }
    if (!offer.gameType || !offer.gameTerms) {
      return jsonError("This offer does not have game terms.", 409);
    }
    if (!offer.gameOwnerAgreedAt || !offer.gameProposerAgreedAt || !offer.gameLockedAt) {
      return jsonError("Both parties must agree to game terms before starting.", 409);
    }

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        gameStartedAt: offer.gameStartedAt ?? new Date(),
      },
      include: offerInclude,
    });

    return jsonOk(updated);
  }

  if (body.gameAction === "RESOLVE_GAME") {
    if (offer.status !== "COUNTERED") {
      return jsonError("Game settlements can only resolve countered offers.", 409);
    }
    if (!offer.gameType || !offer.gameTerms) {
      return jsonError("This offer does not have game terms.", 409);
    }
    if (!offer.gameOwnerAgreedAt || !offer.gameProposerAgreedAt || !offer.gameLockedAt) {
      return jsonError("Both parties must agree to game terms before settlement.", 409);
    }
    if (!offer.gameStartedAt) {
      return jsonError("Start the game session before resolving the result.", 409);
    }
    if (offer.gameResolvedAt || offer.gameWinnerId) {
      return jsonError("This game has already been resolved.", 409);
    }

    const winnerId = typeof body.gameWinnerId === "string" ? body.gameWinnerId.trim() : "";
    if (!winnerId) {
      return jsonError("Winner is required to resolve game settlement.");
    }
    if (winnerId !== offer.post.ownerId && winnerId !== offer.proposerId) {
      return jsonError("Winner must be one of the two trade participants.", 409);
    }

    const resolvedAt = new Date();
    const accepted = await prisma.$transaction(async (tx) => {
      const cashAmount = offer.cashAdjustment ?? 0;
      const amount = Math.abs(cashAmount);
      const payerId = cashAmount >= 0 ? offer.proposerId : offer.post.ownerId;
      const payeeId = cashAmount >= 0 ? offer.post.ownerId : offer.proposerId;

      await tx.tradeOffer.updateMany({
        where: {
          postId: offer.postId,
          id: { not: offer.id },
          status: { in: ["PENDING", "COUNTERED"] },
        },
        data: { status: "DECLINED" },
      });

      await tx.tradePost.update({
        where: { id: offer.postId },
        data: { status: "MATCHED" },
      });

      return tx.tradeOffer.update({
        where: { id: offer.id },
        data: {
          status: "ACCEPTED",
          gameWinnerId: winnerId,
          gameResolvedAt: resolvedAt,
          gameStartedAt: offer.gameStartedAt ?? resolvedAt,
          settlement: amount > 0
            ? {
                upsert: {
                  create: {
                    payerId,
                    payeeId,
                    amount,
                    currency: "usd",
                    status: "REQUIRES_PAYMENT",
                  },
                  update: {
                    payerId,
                    payeeId,
                    amount,
                    currency: "usd",
                    status: offer.settlement?.status === "SUCCEEDED"
                      ? "SUCCEEDED"
                      : "REQUIRES_PAYMENT",
                  },
                },
              }
            : offer.settlement
              ? {
                  delete: true,
                }
              : undefined,
        },
        include: offerInclude,
      });
    });

    return jsonOk(accepted);
  }

  const nextStatus = body.status as NonNullable<UpdateOfferBody["status"]>;

  if (nextStatus === "WITHDRAWN") {
    if (!isProposer) {
      return jsonError("Only the proposer can withdraw this offer.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be withdrawn.");
    }

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "WITHDRAWN",
        settlement: offer.settlement
          ? {
              update: { status: "CANCELED" },
            }
          : undefined,
      },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  if (nextStatus === "ACCEPTED") {
    if (offer.gameType && offer.gameTerms) {
      return jsonError("This counter uses game settlement. Resolve the game result first.", 409);
    }
    const proposerCanAcceptCounter = offer.status === "COUNTERED" && isProposer;
    if (!isOwner && !proposerCanAcceptCounter) {
      return jsonError("Only the trade owner can accept this offer.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be accepted.");
    }

    const accepted = await prisma.$transaction(async (tx) => {
      const cashAmount = offer.cashAdjustment ?? 0;
      const amount = Math.abs(cashAmount);
      const payerId = cashAmount >= 0 ? offer.proposerId : offer.post.ownerId;
      const payeeId = cashAmount >= 0 ? offer.post.ownerId : offer.proposerId;

      await tx.tradeOffer.updateMany({
        where: {
          postId: offer.postId,
          id: { not: offer.id },
          status: { in: ["PENDING", "COUNTERED"] },
        },
        data: { status: "DECLINED" },
      });

      await tx.tradePost.update({
        where: { id: offer.postId },
        data: { status: "MATCHED" },
      });

      return tx.tradeOffer.update({
        where: { id: offer.id },
        data: {
          status: "ACCEPTED",
          settlement: amount > 0
            ? {
                upsert: {
                  create: {
                    payerId,
                    payeeId,
                    amount,
                    currency: "usd",
                    status: "REQUIRES_PAYMENT",
                  },
                  update: {
                    payerId,
                    payeeId,
                    amount,
                    currency: "usd",
                    status: offer.settlement?.status === "SUCCEEDED"
                      ? "SUCCEEDED"
                      : "REQUIRES_PAYMENT",
                  },
                },
              }
            : offer.settlement
              ? {
                  delete: true,
                }
              : undefined,
        },
        include: offerInclude,
      });
    });

    return jsonOk(accepted);
  }

  if (nextStatus === "COUNTERED") {
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be countered.", 409);
    }
    if (offer.status === "PENDING" && !isOwner) {
      return jsonError("Only the trade owner can send the first counter.", 403);
    }
    if (offer.status === "COUNTERED" && offer.gameProposedById === sessionUser.id) {
      return jsonError("Wait for the other party response before countering again.", 409);
    }

    const nextCashAdjustment = body.cashAdjustment !== undefined
      ? parseIntOrNull(body.cashAdjustment)
      : offer.cashAdjustment;
    if (nextCashAdjustment === null) {
      return jsonError("Invalid counter cash adjustment.");
    }

    const nextMessage = body.message !== undefined
      ? (body.message?.trim() || null)
      : offer.message;

    const counterMode = body.counterMode === "GAME" ? "GAME" : "STANDARD";
    const normalizedGameType = normalizeGameType(body.gameType);
    const normalizedGameTerms = normalizeGameTerms(body.gameTerms);

    if (counterMode === "GAME") {
      if (!normalizedGameType) {
        return jsonError("Choose a valid game for this counter.");
      }
      if (!normalizedGameTerms || normalizedGameTerms.length < 12) {
        return jsonError("Game terms must be at least 12 characters.");
      }
    }

    const now = new Date();
    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "COUNTERED",
        message: nextMessage,
        cashAdjustment: nextCashAdjustment,
        gameType: counterMode === "GAME" ? normalizedGameType : null,
        gameTerms: counterMode === "GAME" ? normalizedGameTerms : null,
        gameTermsVersion: counterMode === "GAME" ? ((offer.gameTermsVersion ?? 0) + 1) : null,
        gameProposedById: sessionUser.id,
        gameOwnerAgreedAt: counterMode === "GAME" ? (isOwner ? now : null) : null,
        gameProposerAgreedAt: counterMode === "GAME" ? (isProposer ? now : null) : null,
        gameLockedAt: null,
        gameStartedAt: null,
        gameResolvedAt: null,
        gameWinnerId: null,
        settlement: offer.settlement
          ? {
              update: {
                status: "CANCELED",
              },
            }
          : undefined,
      },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  if (nextStatus === "DECLINED") {
    if (!isOwner) {
      return jsonError("Only the trade owner can update offer state.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be declined.");
    }

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "DECLINED",
        settlement: offer.settlement
          ? {
              update: { status: "CANCELED" },
            }
          : undefined,
      },
      include: offerInclude,
    });
    return jsonOk(updated);
  }

  return jsonError("Unsupported status update.");
}
