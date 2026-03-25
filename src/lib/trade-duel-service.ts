import "server-only";

import { Prisma } from "@prisma/client";
import {
  applyCheckersDuelMove,
  applyChessDuelMove,
  canAutoStartDuel,
  computeDuelDeadline,
  createDuelBaselineSnapshot,
  createInitialDuelState,
  duelExpired,
  duelPartyLabel,
  duelResultSummary,
  normalizeDuelState,
  oppositeDuelParty,
  parseDurationMinutes,
  parseScheduledFor,
  resolveCoinDuel,
  resolvePokerDuel,
  type CheckersPos,
  type DuelParty,
  type TradeDuelMode,
  type TradeDuelState,
} from "@/lib/duels";

export const tradeOfferWithDuelInclude = {
  post: {
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
    },
  },
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
  duel: {
    include: {
      challenger: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
      defender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
      winner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
        },
      },
    },
  },
} satisfies Prisma.TradeOfferInclude;

export type TradeOfferWithDuel = Prisma.TradeOfferGetPayload<{
  include: typeof tradeOfferWithDuelInclude;
}>;

export type TradeOfferWithRequiredDuel = TradeOfferWithDuel & {
  duel: NonNullable<TradeOfferWithDuel["duel"]>;
};

type DuelDraftInput = {
  mode: TradeDuelMode;
  terms: string;
  scheduledForInput?: unknown;
  durationMinutesInput?: unknown;
};

type DuelActionBody =
  | {
      action: "AGREE";
      stateVersion?: number;
    }
  | {
      action: "START";
      stateVersion?: number;
    }
  | {
      action: "MOVE_CHECKERS";
      stateVersion?: number;
      from: CheckersPos;
      to: CheckersPos;
    }
  | {
      action: "MOVE_CHESS";
      stateVersion?: number;
      from: string;
      to: string;
    }
  | {
      action: "RESOLVE_COIN";
      stateVersion?: number;
    }
  | {
      action: "RESOLVE_POKER";
      stateVersion?: number;
    }
  | {
      action: "FORFEIT";
      stateVersion?: number;
    };

type BaselineSnapshot = {
  message: string | null;
  cashAdjustment: number;
};

function parseBaselineSnapshot(value: unknown): BaselineSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { message: null, cashAdjustment: 0 };
  }

  const snapshot = value as Partial<BaselineSnapshot>;
  return {
    message: typeof snapshot.message === "string" && snapshot.message.trim().length > 0
      ? snapshot.message.trim()
      : null,
    cashAdjustment: Number.isFinite(snapshot.cashAdjustment ?? NaN) ? Math.trunc(snapshot.cashAdjustment ?? 0) : 0,
  };
}

export function viewerCanAccessTradeOffer(offer: Pick<TradeOfferWithDuel, "proposerId" | "post">, userId: string) {
  return userId === offer.proposerId || userId === offer.post.ownerId;
}

export function duelPartyForUser(duel: Pick<TradeOfferWithRequiredDuel["duel"], "challengerId" | "defenderId">, userId: string): DuelParty | null {
  if (userId === duel.challengerId) return "CHALLENGER";
  if (userId === duel.defenderId) return "DEFENDER";
  return null;
}

export function deriveTradeDuelStatus(
  duel: Pick<
    TradeOfferWithRequiredDuel["duel"],
    "status" | "challengerAgreedAt" | "defenderAgreedAt" | "scheduledFor" | "startedAt" | "completedAt" | "winnerId"
  >,
  now = new Date(),
) {
  if (duel.completedAt || duel.winnerId) return "COMPLETED" as const;
  if (duel.status === "CANCELED" || duel.status === "EXPIRED") return duel.status;
  if (duel.startedAt) return "ACTIVE" as const;
  if (duel.challengerAgreedAt && duel.defenderAgreedAt) {
    if (duel.scheduledFor && duel.scheduledFor.getTime() > now.getTime()) return "SCHEDULED" as const;
    return "READY" as const;
  }
  return "PENDING" as const;
}

export function createTradeDuelDraftData(
  offer: Pick<TradeOfferWithDuel, "postId" | "post" | "proposerId" | "message" | "cashAdjustment">,
  actorId: string,
  input: DuelDraftInput,
  now = new Date(),
) {
  const scheduledFor = parseScheduledFor(input.scheduledForInput);
  const durationSeconds = parseDurationMinutes(input.durationMinutesInput);
  return {
    challengerId: actorId,
    defenderId: actorId === offer.post.ownerId ? offer.proposerId : offer.post.ownerId,
    postId: offer.postId,
    mode: input.mode,
    terms: input.terms,
    status: "PENDING",
    scheduledFor,
    durationSeconds,
    challengerAgreedAt: now,
    defenderAgreedAt: null,
    startedAt: null,
    deadlineAt: null,
    completedAt: null,
    resultReason: null,
    baselineSnapshot: createDuelBaselineSnapshot(offer.message, offer.cashAdjustment),
    state: createInitialDuelState(input.mode),
    stateVersion: 0,
  };
}

export async function hydrateLegacyTradeDuel(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithDuel,
): Promise<TradeOfferWithDuel> {
  if (offer.duel || !offer.gameType || !offer.gameTerms) {
    return offer;
  }

  const challengerId = offer.gameProposedById === offer.proposerId || offer.gameProposedById === offer.post.ownerId
    ? offer.gameProposedById
    : offer.post.ownerId;
  const defenderId = challengerId === offer.post.ownerId ? offer.proposerId : offer.post.ownerId;

  return tx.tradeOffer.update({
    where: { id: offer.id },
    data: {
      duel: {
        create: {
          postId: offer.postId,
          challengerId,
          defenderId,
          winnerId: offer.gameWinnerId,
          mode: offer.gameType,
          terms: offer.gameTerms,
          status: offer.gameResolvedAt ? "COMPLETED" : offer.gameStartedAt ? "ACTIVE" : offer.gameLockedAt ? "READY" : "PENDING",
          challengerAgreedAt: challengerId === offer.post.ownerId ? offer.gameOwnerAgreedAt : offer.gameProposerAgreedAt,
          defenderAgreedAt: defenderId === offer.post.ownerId ? offer.gameOwnerAgreedAt : offer.gameProposerAgreedAt,
          startedAt: offer.gameStartedAt,
          completedAt: offer.gameResolvedAt,
          resultReason: offer.gameResolvedAt ? "Legacy game result" : null,
          baselineSnapshot: {
            message: offer.message,
            cashAdjustment: offer.cashAdjustment,
          },
          state: offer.gameState ?? createInitialDuelState(offer.gameType as Parameters<typeof createInitialDuelState>[0]),
          stateVersion: offer.gameStateVersion ?? 0,
        },
      },
    },
    include: tradeOfferWithDuelInclude,
  });
}

function settlementWriteInput(
  offer: TradeOfferWithRequiredDuel,
  cashAdjustment: number,
): Prisma.TradeSettlementUpdateOneWithoutOfferNestedInput | undefined {
  const amount = Math.abs(cashAdjustment);
  if (amount <= 0) {
    return offer.settlement
      ? {
          delete: true,
        }
      : undefined;
  }

  const payerId = cashAdjustment >= 0 ? offer.proposerId : offer.post.ownerId;
  const payeeId = cashAdjustment >= 0 ? offer.post.ownerId : offer.proposerId;
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

export async function settleTradeOfferByDuel(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithRequiredDuel,
  winnerParty: DuelParty,
  resultReason: string,
  nextState?: TradeDuelState,
): Promise<TradeOfferWithRequiredDuel> {
  const winnerId = winnerParty === "CHALLENGER" ? offer.duel.challengerId : offer.duel.defenderId;
  const challengerWon = winnerParty === "CHALLENGER";
  const baseline = parseBaselineSnapshot(offer.duel.baselineSnapshot);
  const finalMessage = challengerWon ? offer.message : baseline.message;
  const finalCashAdjustment = challengerWon ? offer.cashAdjustment : baseline.cashAdjustment;
  const resolvedAt = new Date();
  const duelState = nextState ?? normalizeDuelState(offer.duel.mode as TradeDuelMode, offer.duel.state);

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
      message: finalMessage,
      cashAdjustment: finalCashAdjustment,
      gameStartedAt: offer.gameStartedAt ?? offer.duel.startedAt ?? resolvedAt,
      gameResolvedAt: resolvedAt,
      gameWinnerId: winnerId,
      gameState: duelState,
      gameStateVersion: offer.duel.stateVersion,
      duel: {
        update: {
          winnerId,
          status: "COMPLETED",
          completedAt: resolvedAt,
          resultReason,
          state: duelState,
        },
      },
      settlement: settlementWriteInput(offer, finalCashAdjustment),
    },
    include: tradeOfferWithDuelInclude,
  }) as Promise<TradeOfferWithRequiredDuel>;
}

export async function recordTradeDuelAgreement(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithRequiredDuel,
  userId: string,
): Promise<TradeOfferWithRequiredDuel> {
  const role = duelPartyForUser(offer.duel, userId);
  if (!role) {
    throw new Error("Only trade participants can approve duel terms.");
  }
  if (offer.duel.completedAt || offer.duel.status === "COMPLETED") {
    throw new Error("This duel has already been completed.");
  }

  const now = new Date();
  const challengerAgreedAt = role === "CHALLENGER"
    ? (offer.duel.challengerAgreedAt ?? now)
    : offer.duel.challengerAgreedAt;
  const defenderAgreedAt = role === "DEFENDER"
    ? (offer.duel.defenderAgreedAt ?? now)
    : offer.duel.defenderAgreedAt;
  const status = deriveTradeDuelStatus({
    ...offer.duel,
    challengerAgreedAt,
    defenderAgreedAt,
  }, now);

  return tx.tradeOffer.update({
    where: { id: offer.id },
    data: {
      gameOwnerAgreedAt: offer.post.ownerId === userId
        ? (offer.gameOwnerAgreedAt ?? now)
        : offer.gameOwnerAgreedAt,
      gameProposerAgreedAt: offer.proposerId === userId
        ? (offer.gameProposerAgreedAt ?? now)
        : offer.gameProposerAgreedAt,
      gameLockedAt: challengerAgreedAt && defenderAgreedAt ? (offer.gameLockedAt ?? now) : null,
      duel: {
        update: {
          challengerAgreedAt,
          defenderAgreedAt,
          status,
        },
      },
    },
    include: tradeOfferWithDuelInclude,
  }) as Promise<TradeOfferWithRequiredDuel>;
}

export async function startTradeDuel(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithRequiredDuel,
  userId: string,
): Promise<TradeOfferWithRequiredDuel> {
  if (!viewerCanAccessTradeOffer(offer, userId)) {
    throw new Error("Only trade participants can start this duel.");
  }
  if (offer.duel.completedAt || offer.duel.status === "COMPLETED") {
    throw new Error("This duel has already been completed.");
  }
  if (!offer.duel.challengerAgreedAt || !offer.duel.defenderAgreedAt) {
    throw new Error("Both participants must approve duel terms first.");
  }

  const now = new Date();
  const canStart = canAutoStartDuel(deriveTradeDuelStatus(offer.duel, now), offer.duel.scheduledFor, now);
  if (!canStart) {
    throw new Error("This duel is scheduled for later.");
  }

  const duelState = normalizeDuelState(offer.duel.mode as TradeDuelMode, offer.duel.state);
  const deadlineAt = computeDuelDeadline(now, offer.duel.durationSeconds);

  return tx.tradeOffer.update({
    where: { id: offer.id },
    data: {
      gameStartedAt: offer.gameStartedAt ?? now,
      gameState: duelState,
      gameStateVersion: offer.duel.stateVersion,
      duel: {
        update: {
          status: "ACTIVE",
          startedAt: offer.duel.startedAt ?? now,
          deadlineAt,
          state: duelState,
        },
      },
    },
    include: tradeOfferWithDuelInclude,
  }) as Promise<TradeOfferWithRequiredDuel>;
}

function timeoutWinnerForState(state: TradeDuelState): DuelParty {
  if (state.kind === "checkers" || state.kind === "chess") {
    return oppositeDuelParty(state.turn);
  }
  return "DEFENDER";
}

export async function reconcileTradeDuelTimeout(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithRequiredDuel,
): Promise<TradeOfferWithRequiredDuel> {
  if (!offer.duel.startedAt || !offer.duel.deadlineAt) {
    return offer;
  }
  if (offer.duel.completedAt || offer.duel.status === "COMPLETED") {
    return offer;
  }
  if (!duelExpired(offer.duel.deadlineAt)) {
    return offer;
  }

  const duelState = normalizeDuelState(offer.duel.mode as TradeDuelMode, offer.duel.state);
  const winner = timeoutWinnerForState(duelState);
  return settleTradeOfferByDuel(
    tx,
    offer,
    winner,
    `${duelPartyLabel(winner)} wins on the duel clock.`,
    duelState,
  );
}

export async function applyTradeDuelAction(
  tx: Prisma.TransactionClient,
  offer: TradeOfferWithRequiredDuel,
  userId: string,
  body: DuelActionBody,
): Promise<TradeOfferWithRequiredDuel> {
  if (!offer.duel) {
    throw new Error("This offer does not have an active duel.");
  }

  const role = duelPartyForUser(offer.duel, userId);
  if (!role) {
    throw new Error("Only trade participants can act in this duel.");
  }

  if (body.action === "AGREE") {
    return recordTradeDuelAgreement(tx, offer, userId);
  }

  if (body.action === "START") {
    return startTradeDuel(tx, offer, userId);
  }

  if (body.action === "FORFEIT") {
    const duelStatus = deriveTradeDuelStatus(offer.duel);
    if (duelStatus !== "ACTIVE") {
      throw new Error("Forfeit is only available during an active duel.");
    }
    const opponent = role === "CHALLENGER" ? "DEFENDER" : "CHALLENGER";
    const forfeiterLabel = duelPartyLabel(role);
    return settleTradeOfferByDuel(
      tx,
      offer,
      opponent,
      `${forfeiterLabel} forfeited.`,
    );
  }

  const reconciled = await reconcileTradeDuelTimeout(tx, offer);
  if (reconciled.duel?.completedAt || reconciled.duel?.status === "COMPLETED") {
    return reconciled;
  }

  if (!reconciled.duel?.startedAt || deriveTradeDuelStatus(reconciled.duel) !== "ACTIVE") {
    throw new Error("Start the duel before making moves.");
  }

  if (typeof body.stateVersion === "number" && body.stateVersion !== reconciled.duel.stateVersion) {
    throw new Error("The duel state is out of sync. Refresh and try again.");
  }

  const duelMode = reconciled.duel.mode as TradeDuelMode;
  const duelState = normalizeDuelState(duelMode, reconciled.duel.state);
  let result:
    | ReturnType<typeof applyCheckersDuelMove>
    | ReturnType<typeof applyChessDuelMove>
    | ReturnType<typeof resolveCoinDuel>
    | ReturnType<typeof resolvePokerDuel>;

  if (body.action === "MOVE_CHECKERS") {
    if (duelMode !== "checkers") throw new Error("This duel is not using checkers.");
    if (duelState.kind !== "checkers") throw new Error("Checkers duel state is unavailable.");
    result = applyCheckersDuelMove(duelState, role, body.from, body.to);
  } else if (body.action === "MOVE_CHESS") {
    if (duelMode !== "chess") throw new Error("This duel is not using chess.");
    if (duelState.kind !== "chess") throw new Error("Chess duel state is unavailable.");
    result = applyChessDuelMove(duelState, role, body.from, body.to);
  } else if (body.action === "RESOLVE_COIN") {
    if (duelMode !== "coin") throw new Error("This duel is not using a coin flip.");
    if (duelState.kind !== "coin") throw new Error("Coin duel state is unavailable.");
    result = resolveCoinDuel(duelState);
  } else if (body.action === "RESOLVE_POKER") {
    if (duelMode !== "poker") throw new Error("This duel is not using poker.");
    if (duelState.kind !== "poker") throw new Error("Poker duel state is unavailable.");
    result = resolvePokerDuel(duelState);
  } else {
    throw new Error("Unsupported duel action.");
  }

  if (!result.ok) {
    throw new Error(result.error);
  }

  if (result.winner) {
    return settleTradeOfferByDuel(
      tx,
      reconciled as TradeOfferWithRequiredDuel,
      result.winner,
      result.reason ?? duelResultSummary(duelMode, result.nextState),
      result.nextState,
    );
  }

  return tx.tradeOffer.update({
    where: { id: reconciled.id },
    data: {
      gameState: result.nextState,
      gameStateVersion: { increment: 1 },
      duel: {
        update: {
          state: result.nextState,
          stateVersion: { increment: 1 },
        },
      },
    },
    include: tradeOfferWithDuelInclude,
  }) as Promise<TradeOfferWithRequiredDuel>;
}
