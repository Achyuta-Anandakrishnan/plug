import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { ensureTradeSchema } from "@/lib/trade-schema";
import {
  applyTradeDuelAction,
  deriveTradeDuelStatus,
  duelPartyForUser,
  hydrateLegacyTradeDuel,
  reconcileTradeDuelTimeout,
  tradeOfferWithDuelInclude,
  viewerCanAccessTradeOffer,
  type TradeOfferWithDuel,
  type TradeOfferWithRequiredDuel,
} from "@/lib/trade-duel-service";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

type DuelActionBody =
  | { action: "AGREE"; stateVersion?: number }
  | { action: "START"; stateVersion?: number }
  | { action: "MOVE_CHECKERS"; stateVersion?: number; from: { r: number; c: number }; to: { r: number; c: number } }
  | { action: "MOVE_CHESS"; stateVersion?: number; from: string; to: string }
  | { action: "RESOLVE_COIN"; stateVersion?: number }
  | { action: "RESOLVE_POKER"; stateVersion?: number }
  | { action: "FORFEIT"; stateVersion?: number };

async function loadOfferForViewer(offerId: string, userId: string) {
  return prisma.$transaction(async (tx): Promise<TradeOfferWithDuel | null> => {
    const found = await tx.tradeOffer.findUnique({
      where: { id: offerId },
      include: tradeOfferWithDuelInclude,
    });

    if (!found) return null;
    if (!viewerCanAccessTradeOffer(found, userId)) {
      throw new Error("FORBIDDEN");
    }

    const hydrated = await hydrateLegacyTradeDuel(tx, found);
    if (!hydrated.duel) {
      return hydrated;
    }

    return reconcileTradeDuelTimeout(tx, hydrated as TradeOfferWithRequiredDuel);
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  try {
    const { offerId } = await params;
    const offer = await loadOfferForViewer(offerId, sessionUser.id);

    if (!offer) {
      return jsonError("Offer not found.", 404);
    }
    if (!offer.duel) {
      return jsonError("This offer does not have an active duel.", 404);
    }

    return jsonOk({
      offer,
      duel: offer.duel,
      viewerRole: duelPartyForUser(offer.duel, sessionUser.id),
      duelStatus: deriveTradeDuelStatus(offer.duel),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Not authorized to view this duel.", 403);
    }
    console.error("Trade duel GET failed", { error });
    return jsonError("Unable to load duel right now.", 500);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  await ensureTradeSchema().catch(() => null);
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    return jsonError("Authentication required.", 401);
  }

  const body = await parseJson<DuelActionBody>(request);
  if (!body?.action) {
    return jsonError("Invalid duel action payload.");
  }

  try {
    const { offerId } = await params;
    const updated = await prisma.$transaction(async (tx) => {
      const found = await tx.tradeOffer.findUnique({
        where: { id: offerId },
        include: tradeOfferWithDuelInclude,
      });

      if (!found) {
        throw new Error("NOT_FOUND");
      }
      if (!viewerCanAccessTradeOffer(found, sessionUser.id)) {
        throw new Error("FORBIDDEN");
      }

      const hydrated = await hydrateLegacyTradeDuel(tx, found);
      if (!hydrated.duel) {
        throw new Error("NO_DUEL");
      }

      return applyTradeDuelAction(tx, hydrated as TradeOfferWithRequiredDuel, sessionUser.id, body);
    });

    return jsonOk({
      offer: updated,
      duel: updated.duel,
      viewerRole: updated.duel ? duelPartyForUser(updated.duel, sessionUser.id) : null,
      duelStatus: updated.duel ? deriveTradeDuelStatus(updated.duel) : null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Offer not found.", 404);
      if (error.message === "FORBIDDEN") return jsonError("Not authorized to act on this duel.", 403);
      if (error.message === "NO_DUEL") return jsonError("This offer does not have an active duel.", 404);
      return jsonError(error.message, 409);
    }
    console.error("Trade duel PATCH failed", { error });
    return jsonError("Unable to update duel right now.", 500);
  }
}
