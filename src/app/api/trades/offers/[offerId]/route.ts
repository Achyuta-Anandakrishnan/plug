import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getStripeClient, stripeEnabled } from "@/lib/stripe";
import {
  createInitialDuelState,
  isTradeDuelMode,
  normalizeTradeDuelTerms,
} from "@/lib/duels";
import { ensureTradeSchema } from "@/lib/trade-schema";
import { isTradeOfferStatus, parseIntOrNull } from "@/lib/trades";
import {
  createTradeDuelDraftData,
  hydrateLegacyTradeDuel,
  recordTradeDuelAgreement,
  startTradeDuel,
  tradeOfferWithDuelInclude,
  viewerCanAccessTradeOffer,
  type TradeOfferWithRequiredDuel,
  type TradeOfferWithDuel,
} from "@/lib/trade-duel-service";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

type UpdateOfferBody = {
  status?: string;
  message?: string;
  cashAdjustment?: number | string | null;
  counterMode?: "STANDARD" | "GAME" | "DUEL";
  duelMode?: string | null;
  duelTerms?: string | null;
  duelScheduledFor?: string | null;
  duelDurationMinutes?: number | string | null;
  gameType?: string | null;
  gameTerms?: string | null;
  gameAction?: "AGREE_TERMS" | "START_GAME" | "RESOLVE_GAME";
  gameWinnerId?: string | null;
};

const MAX_COUNTER_MESSAGE_LENGTH = 600;
const MAX_COUNTER_CASH_ADJUSTMENT = 100_000_00;

function isOfferExpired(offer: Pick<TradeOfferWithDuel, "expiresAt" | "status">) {
  if (!offer.expiresAt) return false;
  if (!["PENDING", "COUNTERED"].includes(offer.status)) return false;
  return new Date(offer.expiresAt).getTime() <= Date.now();
}

function normalizeCounterMode(value: unknown) {
  return value === "GAME" || value === "DUEL" ? "DUEL" : "STANDARD";
}

function normalizeDuelMode(body: UpdateOfferBody) {
  const candidate = typeof body.duelMode === "string" ? body.duelMode.trim().toLowerCase() : typeof body.gameType === "string" ? body.gameType.trim().toLowerCase() : "";
  return isTradeDuelMode(candidate) ? candidate : null;
}

function normalizeDuelTerms(body: UpdateOfferBody) {
  return normalizeTradeDuelTerms(body.duelTerms ?? body.gameTerms);
}

function cancelDuelWrite(offer: TradeOfferWithDuel) {
  if (!offer.duel || offer.duel.completedAt || offer.duel.status === "COMPLETED") return undefined;
  return {
    update: {
      status: "CANCELED",
      completedAt: new Date(),
      resultReason: "Offer closed before duel completion.",
    },
  };
}

function standardSettlementWrite(offer: TradeOfferWithDuel) {
  const cashAmount = offer.cashAdjustment ?? 0;
  const amount = Math.abs(cashAmount);
  if (amount <= 0) {
    return offer.settlement
      ? {
          delete: true,
        }
      : undefined;
  }

  const payerId = cashAmount >= 0 ? offer.proposerId : offer.post.ownerId;
  const payeeId = cashAmount >= 0 ? offer.post.ownerId : offer.proposerId;
  const createStatus = "REQUIRES_PAYMENT" as const;
  const status: "SUCCEEDED" | "REQUIRES_PAYMENT" = offer.settlement?.status === "SUCCEEDED"
    ? "SUCCEEDED"
    : "REQUIRES_PAYMENT";

  return {
    upsert: {
      create: {
        payerId,
        payeeId,
        amount,
        currency: "usd",
        status: createStatus,
      },
      update: {
        payerId,
        payeeId,
        amount,
        currency: "usd",
        status,
      },
    },
  };
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

  if (body.status && !isTradeOfferStatus(body.status)) {
    return jsonError("Invalid offer status.");
  }

  let offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: tradeOfferWithDuelInclude,
  });

  if (!offer) {
    return jsonError("Offer not found.", 404);
  }

  if (!viewerCanAccessTradeOffer(offer, sessionUser.id)) {
    return jsonError("Not authorized to update this offer.", 403);
  }

  const isOwner = offer.post.ownerId === sessionUser.id;
  const isProposer = offer.proposerId === sessionUser.id;

  if (body.gameAction || offer.gameType) {
    const currentOffer = offer;
    offer = await prisma.$transaction(async (tx) => hydrateLegacyTradeDuel(tx, currentOffer));
  }

  if (body.gameAction === "AGREE_TERMS") {
    if (!offer.duel) {
      return jsonError("No duel is attached to this counter offer.", 409);
    }
    if (isOfferExpired(offer)) {
      return jsonError("This offer has expired.", 409);
    }
    const updated = await prisma.$transaction(async (tx) => recordTradeDuelAgreement(tx, offer as TradeOfferWithRequiredDuel, sessionUser.id));
    return jsonOk(updated);
  }

  if (body.gameAction === "START_GAME") {
    if (!offer.duel) {
      return jsonError("This offer does not have duel terms.", 409);
    }
    if (isOfferExpired(offer)) {
      return jsonError("This offer has expired.", 409);
    }
    const updated = await prisma.$transaction(async (tx) => startTradeDuel(tx, offer as TradeOfferWithRequiredDuel, sessionUser.id));
    return jsonOk(updated);
  }

  if (body.gameAction === "RESOLVE_GAME") {
    return jsonError("Resolve duels from the duel room only.", 409);
  }

  const nextStatus = body.status as NonNullable<UpdateOfferBody["status"]>;

  if (nextStatus === "WITHDRAWN") {
    if (isOfferExpired(offer)) {
      return jsonError("This offer has already expired.", 409);
    }
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
        duel: cancelDuelWrite(offer),
        settlement: offer.settlement
          ? {
              update: { status: "CANCELED" },
            }
          : undefined,
      },
      include: tradeOfferWithDuelInclude,
    });
    return jsonOk(updated);
  }

  if (nextStatus === "ACCEPTED") {
    if (isOfferExpired(offer)) {
      return jsonError("This offer has expired.", 409);
    }
    if (offer.duel || (offer.gameType && offer.gameTerms)) {
      return jsonError("This counter uses duel settlement. Resolve the duel first.", 409);
    }
    const proposerCanAcceptCounter = offer.status === "COUNTERED" && isProposer;
    if (!isOwner && !proposerCanAcceptCounter) {
      return jsonError("Only the trade owner can accept this offer.", 403);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be accepted.");
    }

    const accepted = await prisma.$transaction(async (tx) => {
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
          settlement: standardSettlementWrite(offer),
        },
        include: tradeOfferWithDuelInclude,
      });
    });

    // Auto-create Stripe checkout if cash settlement is required
    let checkoutUrl: string | null = null;
    const settlement = accepted.settlement;
    if (settlement && settlement.amount > 0 && settlement.status === "REQUIRES_PAYMENT" && stripeEnabled()) {
      const stripe = getStripeClient();
      if (stripe) {
        try {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXTAUTH_URL ||
            "http://localhost:3000";

          const session = await stripe.checkout.sessions.create(
            {
              mode: "payment",
              success_url: `${appUrl}/trades/${accepted.postId}?offer=${accepted.id}&settlement=success`,
              cancel_url: `${appUrl}/trades/${accepted.postId}?offer=${accepted.id}&settlement=cancel`,
              payment_method_types: ["card"],
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: settlement.currency,
                    unit_amount: settlement.amount,
                    product_data: {
                      name: `Trade settlement`.slice(0, 120),
                    },
                  },
                },
              ],
              metadata: {
                tradeSettlementId: settlement.id,
                tradeOfferId: accepted.id,
                tradePostId: accepted.postId,
              },
              payment_intent_data: {
                metadata: {
                  tradeSettlementId: settlement.id,
                  tradeOfferId: accepted.id,
                  tradePostId: accepted.postId,
                },
              },
            },
            { idempotencyKey: `trade_checkout_${settlement.id}` },
          );

          checkoutUrl = session.url ?? null;

          await prisma.tradeSettlement.update({
            where: { id: settlement.id },
            data: {
              status: "PROCESSING",
              providerCheckoutSession: session.id,
              providerPaymentIntent: typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            },
          });
        } catch (error) {
          console.error("Stripe checkout create failed on trade acceptance", { offerId: accepted.id, error });
        }
      }
    }

    return jsonOk({ ...accepted, checkoutUrl });
  }

  if (nextStatus === "COUNTERED") {
    if (isOfferExpired(offer)) {
      return jsonError("This offer has expired.", 409);
    }
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return jsonError("Only active offers can be countered.", 409);
    }
    if (offer.status === "PENDING" && !isOwner) {
      return jsonError("Only the trade owner can send the first counter.", 403);
    }
    if (offer.status === "COUNTERED" && (offer.duel?.challengerId === sessionUser.id || offer.gameProposedById === sessionUser.id)) {
      return jsonError("Wait for the other party response before countering again.", 409);
    }

    const nextCashAdjustment = body.cashAdjustment !== undefined
      ? parseIntOrNull(body.cashAdjustment)
      : offer.cashAdjustment;
    if (nextCashAdjustment === null) {
      return jsonError("Invalid counter cash adjustment.");
    }
    if (Math.abs(nextCashAdjustment) > MAX_COUNTER_CASH_ADJUSTMENT) {
      return jsonError("Cash adjustment exceeds the allowed limit.");
    }

    const nextMessage = body.message !== undefined
      ? ((typeof body.message === "string" ? body.message.trim().slice(0, MAX_COUNTER_MESSAGE_LENGTH) : "") || null)
      : offer.message;

    const counterMode = normalizeCounterMode(body.counterMode);
    const duelMode = normalizeDuelMode(body);
    const duelTerms = normalizeDuelTerms(body);

    if (counterMode === "DUEL") {
      if (!duelMode) {
        return jsonError("Choose a valid duel mode for this counter.");
      }
      if (!duelTerms) {
        return jsonError("Duel terms must be at least 12 characters.");
      }
    }

    const now = new Date();
    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "COUNTERED",
        message: nextMessage,
        cashAdjustment: nextCashAdjustment,
        gameType: counterMode === "DUEL" ? duelMode : null,
        gameTerms: counterMode === "DUEL" ? duelTerms : null,
        gameTermsVersion: counterMode === "DUEL" ? ((offer.gameTermsVersion ?? 0) + 1) : null,
        gameProposedById: sessionUser.id,
        gameOwnerAgreedAt: counterMode === "DUEL" ? (isOwner ? now : null) : null,
        gameProposerAgreedAt: counterMode === "DUEL" ? (isProposer ? now : null) : null,
        gameLockedAt: null,
        gameStartedAt: null,
        gameResolvedAt: null,
        gameWinnerId: null,
        gameState: counterMode === "DUEL" && duelMode ? createInitialDuelState(duelMode) : Prisma.JsonNull,
        gameStateVersion: 0,
        duel: counterMode === "DUEL" && duelMode && duelTerms
          ? {
              upsert: {
                create: createTradeDuelDraftData(offer, sessionUser.id, {
                  mode: duelMode,
                  terms: duelTerms,
                  scheduledForInput: body.duelScheduledFor,
                  durationMinutesInput: body.duelDurationMinutes,
                }, now),
                update: createTradeDuelDraftData(offer, sessionUser.id, {
                  mode: duelMode,
                  terms: duelTerms,
                  scheduledForInput: body.duelScheduledFor,
                  durationMinutesInput: body.duelDurationMinutes,
                }, now),
              },
            }
          : offer.duel
            ? { delete: true }
            : undefined,
        settlement: offer.settlement
          ? {
              update: {
                status: "CANCELED",
              },
            }
          : undefined,
      },
      include: tradeOfferWithDuelInclude,
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
        duel: cancelDuelWrite(offer),
        settlement: offer.settlement
          ? {
              update: { status: "CANCELED" },
            }
          : undefined,
      },
      include: tradeOfferWithDuelInclude,
    });
    return jsonOk(updated);
  }

  return jsonError("Unsupported status update.");
}
