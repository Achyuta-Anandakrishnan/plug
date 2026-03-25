import { Chess, type Square } from "chess.js";

export const TRADE_DUEL_MODES = ["checkers", "chess", "coin", "poker"] as const;
export const TRADE_DUEL_STATUSES = ["PENDING", "READY", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELED", "EXPIRED"] as const;

export type TradeDuelMode = (typeof TRADE_DUEL_MODES)[number];
export type TradeDuelStatus = (typeof TRADE_DUEL_STATUSES)[number];
export type DuelParty = "CHALLENGER" | "DEFENDER";
export type CoinResult = "HEADS" | "TAILS";

export type CheckersPos = { r: number; c: number };
type CheckersPiece = { party: DuelParty; king: boolean };
type CheckersCell = CheckersPiece | null;
type CheckersBoard = CheckersCell[][];

export type CheckersDuelState = {
  kind: "checkers";
  board: CheckersBoard;
  turn: DuelParty;
  forcedPiece: CheckersPos | null;
  winner: DuelParty | null;
  note: string;
};

export type ChessDuelState = {
  kind: "chess";
  fen: string;
  turn: DuelParty;
  winner: DuelParty | null;
  note: string;
  lastMove: string | null;
};

export type CoinDuelState = {
  kind: "coin";
  result: CoinResult | null;
  winner: DuelParty | null;
  note: string;
};

export type PokerCard = {
  rank: number;
  label: string;
  suit: "S" | "H" | "D" | "C";
};

export type PokerDuelState = {
  kind: "poker";
  challengerHand: PokerCard[];
  defenderHand: PokerCard[];
  challengerScore: string | null;
  defenderScore: string | null;
  winner: DuelParty | null;
  note: string;
};

export type TradeDuelState =
  | CheckersDuelState
  | ChessDuelState
  | CoinDuelState
  | PokerDuelState;

export type DuelActionResult =
  | { ok: true; nextState: TradeDuelState; winner: DuelParty | null; reason: string | null }
  | { ok: false; error: string };

export type DuelBaselineSnapshot = {
  message: string | null;
  cashAdjustment: number;
};

type PokerScore = {
  rank: number;
  name: string;
  tie: number[];
};

type CheckersMove = {
  from: CheckersPos;
  to: CheckersPos;
  capture?: CheckersPos;
};

const BOARD_SIZE = 8;

const challengerCoinResult: CoinResult = "HEADS";

export function isTradeDuelMode(value: unknown): value is TradeDuelMode {
  return typeof value === "string" && TRADE_DUEL_MODES.includes(value as TradeDuelMode);
}

export function isTradeDuelStatus(value: unknown): value is TradeDuelStatus {
  return typeof value === "string" && TRADE_DUEL_STATUSES.includes(value as TradeDuelStatus);
}

export function normalizeTradeDuelTerms(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 12 && normalized.length <= 1000 ? normalized : null;
}

export function parseScheduledFor(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDurationMinutes(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded < 5 || rounded > 180) return null;
  return rounded * 60;
}

export function createDuelBaselineSnapshot(message: string | null | undefined, cashAdjustment: number | null | undefined): DuelBaselineSnapshot {
  return {
    message: typeof message === "string" && message.trim().length > 0 ? message.trim() : null,
    cashAdjustment: Number.isFinite(cashAdjustment ?? NaN) ? Math.trunc(cashAdjustment ?? 0) : 0,
  };
}

export function createInitialDuelState(mode: TradeDuelMode): TradeDuelState {
  if (mode === "checkers") {
    return {
      kind: "checkers",
      board: createInitialCheckersBoard(),
      turn: "CHALLENGER",
      forcedPiece: null,
      winner: null,
      note: "Challenger opens. Dalow validates every move.",
    };
  }

  if (mode === "chess") {
    return {
      kind: "chess",
      fen: new Chess().fen(),
      turn: "CHALLENGER",
      winner: null,
      note: "Challenger plays white. Defender plays black.",
      lastMove: null,
    };
  }

  if (mode === "coin") {
    return {
      kind: "coin",
      result: null,
      winner: null,
      note: "Heads awards the duel to the challenger. Tails awards it to the defender.",
    };
  }

  return {
    kind: "poker",
    challengerHand: [],
    defenderHand: [],
    challengerScore: null,
    defenderScore: null,
    winner: null,
    note: "Dalow will deal two five-card hands and verify the winner.",
  };
}

export function normalizeDuelState(mode: TradeDuelMode, rawState: unknown): TradeDuelState {
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    return createInitialDuelState(mode);
  }

  const state = rawState as Partial<TradeDuelState>;

  if (mode === "checkers" && state.kind === "checkers" && Array.isArray(state.board)) {
    return {
      kind: "checkers",
      board: state.board as CheckersBoard,
      turn: state.turn === "DEFENDER" ? "DEFENDER" : "CHALLENGER",
      forcedPiece: state.forcedPiece ?? null,
      winner: state.winner === "DEFENDER" ? "DEFENDER" : state.winner === "CHALLENGER" ? "CHALLENGER" : null,
      note: typeof state.note === "string" ? state.note : "Dalow validates every move.",
    };
  }

  if (mode === "chess" && state.kind === "chess" && typeof state.fen === "string") {
    return {
      kind: "chess",
      fen: state.fen,
      turn: state.turn === "DEFENDER" ? "DEFENDER" : "CHALLENGER",
      winner: state.winner === "DEFENDER" ? "DEFENDER" : state.winner === "CHALLENGER" ? "CHALLENGER" : null,
      note: typeof state.note === "string" ? state.note : "Dalow validates every move.",
      lastMove: typeof state.lastMove === "string" ? state.lastMove : null,
    };
  }

  if (mode === "coin" && state.kind === "coin") {
    return {
      kind: "coin",
      result: state.result === "TAILS" ? "TAILS" : state.result === "HEADS" ? "HEADS" : null,
      winner: state.winner === "DEFENDER" ? "DEFENDER" : state.winner === "CHALLENGER" ? "CHALLENGER" : null,
      note: typeof state.note === "string" ? state.note : "Dalow resolves the flip.",
    };
  }

  if (mode === "poker" && state.kind === "poker") {
    return {
      kind: "poker",
      challengerHand: Array.isArray(state.challengerHand) ? (state.challengerHand as PokerCard[]) : [],
      defenderHand: Array.isArray(state.defenderHand) ? (state.defenderHand as PokerCard[]) : [],
      challengerScore: typeof state.challengerScore === "string" ? state.challengerScore : null,
      defenderScore: typeof state.defenderScore === "string" ? state.defenderScore : null,
      winner: state.winner === "DEFENDER" ? "DEFENDER" : state.winner === "CHALLENGER" ? "CHALLENGER" : null,
      note: typeof state.note === "string" ? state.note : "Dalow resolves the hand.",
    };
  }

  return createInitialDuelState(mode);
}

export function duelPartyLabel(party: DuelParty) {
  return party === "CHALLENGER" ? "Challenger" : "Defender";
}

export function duelRoleForViewer(challengerId: string, defenderId: string, userId: string | null | undefined): DuelParty | null {
  if (!userId) return null;
  if (userId === challengerId) return "CHALLENGER";
  if (userId === defenderId) return "DEFENDER";
  return null;
}

export function applyCheckersDuelMove(
  state: CheckersDuelState,
  actor: DuelParty,
  from: CheckersPos,
  to: CheckersPos,
): DuelActionResult {
  if (state.winner) {
    return { ok: false, error: "This duel has already been settled." };
  }
  if (state.turn !== actor) {
    return { ok: false, error: "Wait for your turn." };
  }

  const piece = state.board[from.r]?.[from.c];
  if (!piece || piece.party !== actor) {
    return { ok: false, error: "Select one of your own pieces." };
  }

  if (state.forcedPiece && (state.forcedPiece.r !== from.r || state.forcedPiece.c !== from.c)) {
    return { ok: false, error: "You must continue the capture sequence with the same piece." };
  }

  const mustCapture = getAllCheckersMoves(state.board, actor, true).length > 0;
  const legalMoves = getLegalCheckersMoves(state.board, from, mustCapture || Boolean(state.forcedPiece));
  const chosenMove = legalMoves.find((entry) => entry.to.r === to.r && entry.to.c === to.c);
  if (!chosenMove) {
    return { ok: false, error: mustCapture ? "A capture is required." : "That move is not legal." };
  }

  const { board: nextBoard, landed } = applyCheckersMove(state.board, chosenMove);

  if (chosenMove.capture) {
    const chain = getLegalCheckersMoves(nextBoard, landed, true);
    if (chain.length > 0) {
      return {
        ok: true,
        nextState: {
          kind: "checkers",
          board: nextBoard,
          turn: actor,
          forcedPiece: landed,
          winner: null,
          note: `${duelPartyLabel(actor)} must continue capturing with the same piece.`,
        },
        winner: null,
        reason: null,
      };
    }
  }

  const opponent = oppositeDuelParty(actor);
  const opponentHasPieces = checkersHasPieces(nextBoard, opponent);
  const opponentHasMoves = getAllCheckersMoves(nextBoard, opponent).length > 0;

  if (!opponentHasPieces || !opponentHasMoves) {
    return {
      ok: true,
      nextState: {
        kind: "checkers",
        board: nextBoard,
        turn: opponent,
        forcedPiece: null,
        winner: actor,
        note: `${duelPartyLabel(actor)} wins checkers.`,
      },
      winner: actor,
      reason: "Checkers win",
    };
  }

  return {
    ok: true,
    nextState: {
      kind: "checkers",
      board: nextBoard,
      turn: opponent,
      forcedPiece: null,
      winner: null,
      note: `${duelPartyLabel(opponent)} to move.`,
    },
    winner: null,
    reason: null,
  };
}

export function applyChessDuelMove(
  state: ChessDuelState,
  actor: DuelParty,
  from: string,
  to: string,
): DuelActionResult {
  if (state.winner) {
    return { ok: false, error: "This duel has already been settled." };
  }
  if (state.turn !== actor) {
    return { ok: false, error: "Wait for your turn." };
  }
  if (!isChessSquare(from) || !isChessSquare(to)) {
    return { ok: false, error: "Move coordinates are invalid." };
  }

  const chess = new Chess(state.fen);
  const expectedColor = actor === "CHALLENGER" ? "w" : "b";
  if (chess.turn() !== expectedColor) {
    return { ok: false, error: "The duel state is out of sync. Refresh and try again." };
  }

  const move = chess.move({ from, to, promotion: "q" });
  if (!move) {
    return { ok: false, error: "That chess move is not legal." };
  }

  if (chess.isCheckmate()) {
    return {
      ok: true,
      nextState: {
        kind: "chess",
        fen: chess.fen(),
        turn: oppositeDuelParty(actor),
        winner: actor,
        note: `${duelPartyLabel(actor)} wins by checkmate.`,
        lastMove: move.san,
      },
      winner: actor,
      reason: "Chess checkmate",
    };
  }

  if (chess.isDraw()) {
    const tiebreakWinner = houseTiebreakWinner();
    return {
      ok: true,
      nextState: {
        kind: "chess",
        fen: chess.fen(),
        turn: oppositeDuelParty(actor),
        winner: tiebreakWinner,
        note: `Chess ended drawn. Dalow tiebreak awarded the duel to the ${duelPartyLabel(tiebreakWinner).toLowerCase()}.`,
        lastMove: move.san,
      },
      winner: tiebreakWinner,
      reason: "Chess draw resolved by Dalow tiebreak",
    };
  }

  return {
    ok: true,
    nextState: {
      kind: "chess",
      fen: chess.fen(),
      turn: chess.turn() === "w" ? "CHALLENGER" : "DEFENDER",
      winner: null,
      note: chess.isCheck()
        ? `${duelPartyLabel(chess.turn() === "w" ? "CHALLENGER" : "DEFENDER")} to move in check.`
        : `${duelPartyLabel(chess.turn() === "w" ? "CHALLENGER" : "DEFENDER")} to move.`,
      lastMove: move.san,
    },
    winner: null,
    reason: null,
  };
}

export function resolveCoinDuel(state: CoinDuelState): DuelActionResult {
  if (state.winner || state.result) {
    return { ok: false, error: "This coin duel has already been flipped." };
  }

  const result: CoinResult = cryptoRandom() < 0.5 ? "HEADS" : "TAILS";
  const winner: DuelParty = result === challengerCoinResult ? "CHALLENGER" : "DEFENDER";

  return {
    ok: true,
    nextState: {
      kind: "coin",
      result,
      winner,
      note: `${result} lands. ${duelPartyLabel(winner)} wins the duel.`,
    },
    winner,
    reason: `Coin flip ${result.toLowerCase()}`,
  };
}

export function resolvePokerDuel(state: PokerDuelState): DuelActionResult {
  if (state.winner || state.challengerHand.length > 0 || state.defenderHand.length > 0) {
    return { ok: false, error: "This poker duel has already been dealt." };
  }

  const deck = shuffleDeck(buildDeck());
  const challengerHand = deck.slice(0, 5);
  const defenderHand = deck.slice(5, 10);
  const challengerScore = evaluatePokerHand(challengerHand);
  const defenderScore = evaluatePokerHand(defenderHand);
  const comparison = compareTie(
    [challengerScore.rank, ...challengerScore.tie],
    [defenderScore.rank, ...defenderScore.tie],
  );
  const winner = comparison === 0 ? houseTiebreakWinner() : comparison > 0 ? "CHALLENGER" : "DEFENDER";

  return {
    ok: true,
    nextState: {
      kind: "poker",
      challengerHand,
      defenderHand,
      challengerScore: challengerScore.name,
      defenderScore: defenderScore.name,
      winner,
      note: comparison === 0
        ? `Both hands tied. Dalow tiebreak awarded the duel to the ${duelPartyLabel(winner).toLowerCase()}.`
        : `${duelPartyLabel(winner)} wins the poker duel.`,
    },
    winner,
    reason: comparison === 0 ? "Poker tie resolved by Dalow tiebreak" : "Poker hand win",
  };
}

export function canAutoStartDuel(status: TradeDuelStatus, scheduledFor: Date | null | undefined, now = new Date()) {
  if (status === "READY") return true;
  if (status !== "SCHEDULED") return false;
  if (!scheduledFor) return true;
  return scheduledFor.getTime() <= now.getTime();
}

export function computeDuelDeadline(startedAt: Date, durationSeconds: number | null | undefined) {
  if (!durationSeconds || durationSeconds <= 0) return null;
  return new Date(startedAt.getTime() + durationSeconds * 1000);
}

export function duelExpired(deadlineAt: Date | null | undefined, now = new Date()) {
  if (!deadlineAt) return false;
  return deadlineAt.getTime() <= now.getTime();
}

export function oppositeDuelParty(party: DuelParty): DuelParty {
  return party === "CHALLENGER" ? "DEFENDER" : "CHALLENGER";
}

function isDarkSquare(r: number, c: number) {
  return (r + c) % 2 === 1;
}

function inBounds(r: number, c: number) {
  return r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;
}

function createInitialCheckersBoard(): CheckersBoard {
  const board: CheckersBoard = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as CheckersCell),
  );

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (!isDarkSquare(r, c)) continue;
      if (r <= 2) board[r][c] = { party: "DEFENDER", king: false };
      if (r >= 5) board[r][c] = { party: "CHALLENGER", king: false };
    }
  }

  return board;
}

function cloneCheckersBoard(board: CheckersBoard): CheckersBoard {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function directionsForCheckersPiece(piece: CheckersPiece): Array<[number, number]> {
  if (piece.king) return [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  return piece.party === "DEFENDER" ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
}

function getLegalCheckersMoves(board: CheckersBoard, from: CheckersPos, captureOnly = false): CheckersMove[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];

  const moves: CheckersMove[] = [];

  for (const [dr, dc] of directionsForCheckersPiece(piece)) {
    const r1 = from.r + dr;
    const c1 = from.c + dc;
    if (!inBounds(r1, c1)) continue;

    const target = board[r1][c1];
    if (!captureOnly && !target) {
      moves.push({ from, to: { r: r1, c: c1 } });
      continue;
    }

    const r2 = from.r + dr * 2;
    const c2 = from.c + dc * 2;
    if (!inBounds(r2, c2)) continue;
    if (!target || target.party === piece.party || board[r2][c2] !== null) continue;
    moves.push({ from, to: { r: r2, c: c2 }, capture: { r: r1, c: c1 } });
  }

  return moves;
}

function getAllCheckersMoves(board: CheckersBoard, party: DuelParty, captureOnly = false): CheckersMove[] {
  const all: CheckersMove[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.party !== party) continue;
      all.push(...getLegalCheckersMoves(board, { r, c }, captureOnly));
    }
  }
  return all;
}

function applyCheckersMove(board: CheckersBoard, move: CheckersMove): { board: CheckersBoard; landed: CheckersPos } {
  const next = cloneCheckersBoard(board);
  const piece = next[move.from.r][move.from.c];
  if (!piece) return { board: next, landed: move.to };

  next[move.from.r][move.from.c] = null;
  if (move.capture) {
    next[move.capture.r][move.capture.c] = null;
  }

  const promoted =
    piece.king
    || (piece.party === "DEFENDER" && move.to.r === BOARD_SIZE - 1)
    || (piece.party === "CHALLENGER" && move.to.r === 0);
  next[move.to.r][move.to.c] = { party: piece.party, king: promoted };

  return { board: next, landed: move.to };
}

function checkersHasPieces(board: CheckersBoard, party: DuelParty) {
  for (const row of board) {
    for (const cell of row) {
      if (cell?.party === party) return true;
    }
  }
  return false;
}

function buildDeck(): PokerCard[] {
  const ranks: Array<{ rank: number; label: string }> = [
    { rank: 14, label: "A" },
    { rank: 13, label: "K" },
    { rank: 12, label: "Q" },
    { rank: 11, label: "J" },
    { rank: 10, label: "10" },
    { rank: 9, label: "9" },
    { rank: 8, label: "8" },
    { rank: 7, label: "7" },
    { rank: 6, label: "6" },
    { rank: 5, label: "5" },
    { rank: 4, label: "4" },
    { rank: 3, label: "3" },
    { rank: 2, label: "2" },
  ];
  const suits: PokerCard["suit"][] = ["S", "H", "D", "C"];
  const deck: PokerCard[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank: rank.rank, label: rank.label });
    }
  }
  return deck;
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xffffffff + 1);
}

function shuffleDeck(deck: PokerCard[]) {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(cryptoRandom() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function compareTie(a: number[], b: number[]) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function evaluatePokerHand(cards: PokerCard[]): PokerScore {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const suits = cards.map((card) => card.suit);
  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = new Set(suits).size === 1;
  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  const isWheel = JSON.stringify(uniqueRanks) === JSON.stringify([14, 5, 4, 3, 2]);
  const isStraight = uniqueRanks.length === 5 && (uniqueRanks[0] - uniqueRanks[4] === 4 || isWheel);
  const straightHigh = isWheel ? 5 : uniqueRanks[0];

  if (isStraight && isFlush) return { rank: 8, name: "Straight flush", tie: [straightHigh] };
  if (groups[0][1] === 4) return { rank: 7, name: "Four of a kind", tie: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { rank: 6, name: "Full house", tie: [groups[0][0], groups[1][0]] };
  if (isFlush) return { rank: 5, name: "Flush", tie: ranks };
  if (isStraight) return { rank: 4, name: "Straight", tie: [straightHigh] };
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((entry) => entry[0]).sort((a, b) => b - a);
    return { rank: 3, name: "Three of a kind", tie: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairRanks = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups.find((entry) => entry[1] === 1)?.[0] ?? 0;
    return { rank: 2, name: "Two pair", tie: [...pairRanks, kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((entry) => entry[0]).sort((a, b) => b - a);
    return { rank: 1, name: "Pair", tie: [groups[0][0], ...kickers] };
  }
  return { rank: 0, name: "High card", tie: ranks };
}

function isChessSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

function houseTiebreakWinner(): DuelParty {
  return cryptoRandom() < 0.5 ? "CHALLENGER" : "DEFENDER";
}

export function duelResultSummary(mode: TradeDuelMode, state: TradeDuelState) {
  if (mode === "coin" && state.kind === "coin" && state.result) {
    return `${state.result} · ${state.note}`;
  }
  return state.note;
}
