import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isTradeOfferStatus, parseIntOrNull } from "@/lib/trades";
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

export async function PATCH(request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  const { offerId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<UpdateOfferBody>(request);
  if (!body?.status || !isTradeOfferStatus(body.status)) {
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

  const nextStatus = body.status;

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
    if (!isOwner) {
      return jsonError("Only the trade owner can update offer state.", 403);
    }
    if (offer.status !== "PENDING") {
      return jsonError("Counter offers can only be sent once per offer.", 409);
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

    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "COUNTERED",
        message: nextMessage,
        cashAdjustment: nextCashAdjustment,
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
