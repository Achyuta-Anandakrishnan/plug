"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import { CheckersLoader } from "@/components/CheckersLoader";
import type { TradeOfferItem, TradeGameType, TradePostDetail } from "@/lib/trade-client";

type Side = "TOP" | "BOTTOM";
type GameMode = TradeGameType;

type Piece = {
  side: Side;
  king: boolean;
};

type Cell = Piece | null;
type Board = Cell[][];

type Pos = { r: number; c: number };

type Move = {
  from: Pos;
  to: Pos;
  capture?: Pos;
};

type PokerCard = {
  rank: number;
  label: string;
  suit: "S" | "H" | "D" | "C";
};

type PokerScore = {
  rank: number;
  name: string;
  tie: number[];
};

const BOARD_SIZE = 8;

const GAME_OPTIONS: Array<{ mode: GameMode; label: string; description: string }> = [
  { mode: "checkers", label: "Checkers", description: "Classic capture rules." },
  { mode: "chess", label: "Chess", description: "Full chess board rules." },
  { mode: "coin", label: "Flip coin", description: "Instant 50/50 settlement." },
  { mode: "poker", label: "Hand of poker", description: "Deal two 5-card hands." },
];

const chessPieceToGlyph: Record<"w" | "b", Record<PieceSymbol, string>> = {
  w: { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" },
  b: { p: "p", r: "r", n: "n", b: "b", q: "q", k: "k" },
};

function isDarkSquare(r: number, c: number) {
  return (r + c) % 2 === 1;
}

function inBounds(r: number, c: number) {
  return r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;
}

function opposite(side: Side): Side {
  return side === "TOP" ? "BOTTOM" : "TOP";
}

function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Cell),
  );

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (!isDarkSquare(r, c)) continue;
      if (r <= 2) board[r][c] = { side: "TOP", king: false };
      if (r >= 5) board[r][c] = { side: "BOTTOM", king: false };
    }
  }

  return board;
}

function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => (cell ? { side: cell.side, king: cell.king } : null)),
  );
}

function directionsFor(piece: Piece): Array<[number, number]> {
  if (piece.king) return [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  return piece.side === "TOP" ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
}

function getLegalMoves(board: Board, from: Pos, captureOnly = false): Move[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];

  const moves: Move[] = [];

  for (const [dr, dc] of directionsFor(piece)) {
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
    if (!target || target.side === piece.side) continue;
    if (board[r2][c2] !== null) continue;

    moves.push({ from, to: { r: r2, c: c2 }, capture: { r: r1, c: c1 } });
  }

  return moves;
}

function getAllMoves(board: Board, side: Side, captureOnly = false): Move[] {
  const all: Move[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.side !== side) continue;
      all.push(...getLegalMoves(board, { r, c }, captureOnly));
    }
  }
  return all;
}

function applyMove(board: Board, move: Move): { board: Board; landed: Pos } {
  const next = cloneBoard(board);
  const piece = next[move.from.r][move.from.c];
  if (!piece) return { board: next, landed: move.to };

  next[move.from.r][move.from.c] = null;
  if (move.capture) next[move.capture.r][move.capture.c] = null;

  const promoted =
    piece.king
    || (piece.side === "TOP" && move.to.r === BOARD_SIZE - 1)
    || (piece.side === "BOTTOM" && move.to.r === 0);
  next[move.to.r][move.to.c] = { side: piece.side, king: promoted };

  return { board: next, landed: move.to };
}

function hasPieces(board: Board, side: Side) {
  for (const row of board) {
    for (const cell of row) {
      if (cell?.side === side) return true;
    }
  }
  return false;
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
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);

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
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 6, name: "Full house", tie: [groups[0][0], groups[1][0]] };
  if (isFlush) return { rank: 5, name: "Flush", tie: ranks };
  if (isStraight) return { rank: 4, name: "Straight", tie: [straightHigh] };
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((entry) => entry[0]).sort((a, b) => b - a);
    return { rank: 3, name: "Three of a kind", tie: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
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

function shuffleDeck(deck: PokerCard[]) {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function isChessSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

export default function TradeDisputeGamePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tradeId = useMemo(
    () => (Array.isArray(params.id) ? params.id[0] : params.id),
    [params.id],
  );
  const offerId = searchParams.get("offer") ?? "";

  const initialMode = (() => {
    const queryMode = (searchParams.get("mode") ?? "").toLowerCase();
    if (["checkers", "chess", "coin", "poker"].includes(queryMode)) return queryMode as GameMode;
    return "checkers" as GameMode;
  })();

  const [mode, setMode] = useState<GameMode>(initialMode);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateError, setGateError] = useState("");
  const [activeOffer, setActiveOffer] = useState<TradeOfferItem | null>(null);

  const [checkersBoard, setCheckersBoard] = useState<Board>(() => createInitialBoard());
  const [checkersTurn, setCheckersTurn] = useState<Side>("BOTTOM");
  const [checkersSelected, setCheckersSelected] = useState<Pos | null>(null);
  const [checkersForcedPiece, setCheckersForcedPiece] = useState<Pos | null>(null);
  const [checkersWinner, setCheckersWinner] = useState<Side | null>(null);
  const [checkersStatus, setCheckersStatus] = useState("Bottom side starts. Tap a piece to move.");

  const [chessFen, setChessFen] = useState(() => new Chess().fen());
  const [chessSelected, setChessSelected] = useState<Square | null>(null);
  const [chessLegalTargets, setChessLegalTargets] = useState<Square[]>([]);
  const [chessStatus, setChessStatus] = useState("White to move.");

  const [coinChoice, setCoinChoice] = useState<"HEADS" | "TAILS">("HEADS");
  const [coinResult, setCoinResult] = useState<"HEADS" | "TAILS" | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);

  const [pokerTop, setPokerTop] = useState<PokerCard[]>([]);
  const [pokerBottom, setPokerBottom] = useState<PokerCard[]>([]);
  const [pokerStatus, setPokerStatus] = useState("Deal a hand to settle this trade.");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!tradeId || !offerId) {
        if (!cancelled) {
          setGateError("Select an offer from the trade page before opening the game.");
          setGateLoading(false);
        }
        return;
      }

      setGateLoading(true);
      setGateError("");
      try {
        const response = await fetchClientApi(`/api/trades/${encodeURIComponent(tradeId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as TradePostDetail & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load trade offer.");
        }
        const offer = payload.offers.find((entry) => entry.id === offerId);
        if (!offer) {
          throw new Error("Offer unavailable for this account.");
        }
        if (!offer.gameType || !offer.gameTerms) {
          throw new Error("This counter offer has no game terms.");
        }
        if (!offer.gameOwnerAgreedAt || !offer.gameProposerAgreedAt || !offer.gameLockedAt) {
          throw new Error("Both parties must agree to game terms before starting.");
        }

        const startResponse = await fetchClientApi(`/api/trades/offers/${encodeURIComponent(offerId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameAction: "START_GAME" }),
        });
        const startPayload = (await startResponse.json()) as TradeOfferItem & { error?: string };
        if (!startResponse.ok) {
          throw new Error(startPayload.error || "Unable to start game session.");
        }
        const startedOffer = startPayload as TradeOfferItem;
        if (!cancelled) {
          setActiveOffer(startedOffer);
          setMode(startedOffer.gameType as GameMode);
          setGateLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setGateError(normalizeClientError(err, "Unable to start game session."));
          setGateLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [offerId, tradeId]);

  const mustCapture = getAllMoves(checkersBoard, checkersTurn, true).length > 0;

  const resetCheckers = () => {
    setCheckersBoard(createInitialBoard());
    setCheckersTurn("BOTTOM");
    setCheckersSelected(null);
    setCheckersForcedPiece(null);
    setCheckersWinner(null);
    setCheckersStatus("Bottom side starts. Tap a piece to move.");
  };

  const selectCheckersPiece = (pos: Pos) => {
    if (checkersWinner) return;
    const piece = checkersBoard[pos.r][pos.c];
    if (!piece || piece.side !== checkersTurn) return;

    if (checkersForcedPiece && (checkersForcedPiece.r !== pos.r || checkersForcedPiece.c !== pos.c)) {
      setCheckersStatus("You must continue with the same piece after a capture.");
      return;
    }

    if (mustCapture && getLegalMoves(checkersBoard, pos, true).length === 0) {
      setCheckersStatus("Capture is required. Select a piece that can capture.");
      return;
    }

    setCheckersSelected(pos);
    setCheckersStatus(piece.king ? "King selected." : "Piece selected.");
  };

  const tryCheckersMoveTo = (to: Pos) => {
    if (!checkersSelected || checkersWinner) return;

    const legal = getLegalMoves(checkersBoard, checkersSelected, mustCapture || Boolean(checkersForcedPiece));
    const move = legal.find((entry) => entry.to.r === to.r && entry.to.c === to.c);
    if (!move) return;

    const mover = checkersTurn;
    const { board: nextBoard, landed } = applyMove(checkersBoard, move);

    if (move.capture) {
      const chain = getLegalMoves(nextBoard, landed, true);
      if (chain.length > 0) {
        setCheckersBoard(nextBoard);
        setCheckersSelected(landed);
        setCheckersForcedPiece(landed);
        setCheckersStatus("Capture again with the same piece.");
        return;
      }
    }

    const nextTurn = opposite(mover);
    const opponentHasPieces = hasPieces(nextBoard, nextTurn);
    const opponentHasMoves = getAllMoves(nextBoard, nextTurn).length > 0;

    setCheckersBoard(nextBoard);
    setCheckersSelected(null);
    setCheckersForcedPiece(null);

    if (!opponentHasPieces || !opponentHasMoves) {
      setCheckersWinner(mover);
      setCheckersStatus(`${mover === "BOTTOM" ? "Bottom" : "Top"} side wins checkers.`);
      return;
    }

    setCheckersTurn(nextTurn);
    setCheckersStatus(`${nextTurn === "BOTTOM" ? "Bottom" : "Top"} side to move.`);
  };

  const chess = useMemo(() => new Chess(chessFen), [chessFen]);

  const resetChess = () => {
    const game = new Chess();
    setChessFen(game.fen());
    setChessSelected(null);
    setChessLegalTargets([]);
    setChessStatus("White to move.");
  };

  const updateChessStatus = (game: Chess) => {
    if (game.isCheckmate()) {
      setChessStatus(`${game.turn() === "w" ? "Black" : "White"} wins by checkmate.`);
      return;
    }
    if (game.isDraw()) {
      setChessStatus("Draw.");
      return;
    }
    const turnLabel = game.turn() === "w" ? "White" : "Black";
    setChessStatus(game.isCheck() ? `${turnLabel} to move (check).` : `${turnLabel} to move.`);
  };

  const onChessSquareClick = (squareRaw: string) => {
    if (!isChessSquare(squareRaw)) return;
    const square = squareRaw as Square;
    const piece = chess.get(square);

    if (chess.isGameOver()) {
      updateChessStatus(chess);
      return;
    }

    if (chessSelected) {
      const move = chess.move({ from: chessSelected, to: square, promotion: "q" });
      if (move) {
        setChessFen(chess.fen());
        setChessSelected(null);
        setChessLegalTargets([]);
        updateChessStatus(chess);
        return;
      }

      if (piece && piece.color === chess.turn()) {
        const moves = chess.moves({ square, verbose: true }).map((entry) => entry.to as Square);
        setChessSelected(square);
        setChessLegalTargets(moves);
        return;
      }

      setChessSelected(null);
      setChessLegalTargets([]);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      const moves = chess.moves({ square, verbose: true }).map((entry) => entry.to as Square);
      setChessSelected(square);
      setChessLegalTargets(moves);
    }
  };

  const flipCoin = async () => {
    setCoinFlipping(true);
    setCoinResult(null);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const result = Math.random() < 0.5 ? "HEADS" : "TAILS";
    setCoinResult(result);
    setCoinFlipping(false);
  };

  const dealPoker = () => {
    const deck = shuffleDeck(buildDeck());
    const topHand = deck.slice(0, 5);
    const bottomHand = deck.slice(5, 10);
    setPokerTop(topHand);
    setPokerBottom(bottomHand);

    const topScore = evaluatePokerHand(topHand);
    const bottomScore = evaluatePokerHand(bottomHand);

    if (topScore.rank > bottomScore.rank) {
      setPokerStatus(`Top side wins with ${topScore.name}.`);
      return;
    }
    if (topScore.rank < bottomScore.rank) {
      setPokerStatus(`Bottom side wins with ${bottomScore.name}.`);
      return;
    }

    const tieResult = compareTie(topScore.tie, bottomScore.tie);
    if (tieResult > 0) {
      setPokerStatus(`Top side wins with ${topScore.name}.`);
      return;
    }
    if (tieResult < 0) {
      setPokerStatus(`Bottom side wins with ${bottomScore.name}.`);
      return;
    }
    setPokerStatus(`Split pot: both sides have ${topScore.name}.`);
  };

  if (gateLoading) {
    return <CheckersLoader title="Loading game terms..." compact className="ios-empty" />;
  }

  if (gateError) {
    return (
      <div className="ios-screen">
        <section className="ios-hero space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="ios-title">Trade Game Settlement</h1>
            <Link
              href={`/trades/${encodeURIComponent(tradeId)}`}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
            >
              Back to trade
            </Link>
          </div>
        </section>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {gateError}
        </div>
      </div>
    );
  }

  return (
    <div className="ios-screen">
      <section className="ios-hero space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="ios-title">Trade Game Settlement</h1>
          <Link
            href={`/trades/${encodeURIComponent(tradeId)}`}
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
          >
            Back to trade
          </Link>
        </div>
        <p className="ios-subtitle">
          Agreed game: {activeOffer?.gameType ?? "-"} · Terms locked by both parties.
        </p>
        {activeOffer?.gameTerms ? (
          <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
            {activeOffer.gameTerms}
          </div>
        ) : null}
      </section>

      <section className="ios-panel p-4 sm:p-5 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {GAME_OPTIONS.map((entry) => (
            <button
              key={entry.mode}
              type="button"
              onClick={() => setMode(entry.mode)}
              disabled={entry.mode !== activeOffer?.gameType}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                mode === entry.mode
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800"
              } ${entry.mode !== activeOffer?.gameType ? "opacity-45" : ""}`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">{entry.label}</p>
              <p className={`mt-1 text-xs ${mode === entry.mode ? "text-white/80" : "text-slate-500"}`}>{entry.description}</p>
            </button>
          ))}
        </div>
      </section>

      {mode === "checkers" ? (
        <section className="ios-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {checkersWinner
                ? `Winner: ${checkersWinner === "BOTTOM" ? "Bottom side" : "Top side"}`
                : `Turn: ${checkersTurn === "BOTTOM" ? "Bottom side" : "Top side"}`}
            </p>
            <button
              type="button"
              onClick={resetCheckers}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
            >
              Reset checkers
            </button>
          </div>

          <p className="text-sm text-slate-600">{checkersStatus}</p>

          <div className="mx-auto w-full max-w-[560px]">
            <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-3xl border border-slate-300 bg-slate-200">
              {checkersBoard.map((row, r) =>
                row.map((cell, c) => {
                  const dark = isDarkSquare(r, c);
                  const isSelected = checkersSelected?.r === r && checkersSelected?.c === c;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => {
                        if (cell) selectCheckersPiece({ r, c });
                        else tryCheckersMoveTo({ r, c });
                      }}
                      className={`relative flex items-center justify-center ${
                        dark ? "bg-slate-700" : "bg-slate-100"
                      } ${isSelected ? "ring-2 ring-inset ring-blue-400" : ""}`}
                    >
                      {cell ? (
                        <div
                          className={`flex h-[70%] w-[70%] items-center justify-center rounded-full text-base font-bold ${
                            cell.side === "BOTTOM"
                              ? "bg-white text-slate-900"
                              : "bg-slate-900 text-white"
                          }`}
                        >
                          {cell.king ? "K" : ""}
                        </div>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </section>
      ) : null}

      {mode === "chess" ? (
        <section className="ios-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">{chessStatus}</p>
            <button
              type="button"
              onClick={resetChess}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
            >
              Reset chess
            </button>
          </div>

          <div className="mx-auto w-full max-w-[560px]">
            <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-3xl border border-slate-300">
              {chess.board().map((row, rowIdx) =>
                row.map((piece, colIdx) => {
                  const file = String.fromCharCode(97 + colIdx);
                  const rank = String(8 - rowIdx);
                  const square = `${file}${rank}`;
                  const dark = (rowIdx + colIdx) % 2 === 1;
                  const selected = chessSelected === square;
                  const legalTarget = chessLegalTargets.includes(square as Square);

                  return (
                    <button
                      key={square}
                      type="button"
                      onClick={() => onChessSquareClick(square)}
                      className={`relative flex items-center justify-center ${
                        dark ? "bg-slate-700" : "bg-slate-100"
                      } ${selected ? "ring-2 ring-inset ring-blue-400" : ""}`}
                    >
                      {legalTarget ? <span className="absolute h-2.5 w-2.5 rounded-full bg-blue-400/80" /> : null}
                      <span className={`text-3xl font-bold ${piece?.color === "w" ? "text-white" : "text-slate-900"}`}>
                        {piece ? chessPieceToGlyph[piece.color][piece.type] : ""}
                      </span>
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </section>
      ) : null}

      {mode === "coin" ? (
        <section className="ios-panel p-4 sm:p-5 space-y-4">
          <p className="text-sm text-slate-600">Pick a side and flip.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCoinChoice("HEADS")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                coinChoice === "HEADS" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Heads
            </button>
            <button
              type="button"
              onClick={() => setCoinChoice("TAILS")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                coinChoice === "TAILS" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Tails
            </button>
            <button
              type="button"
              onClick={() => void flipCoin()}
              disabled={coinFlipping}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
            >
              {coinFlipping ? "Flipping..." : "Flip coin"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Result</p>
            <p className="mt-2 font-display text-4xl text-slate-900">{coinResult ?? "-"}</p>
            {coinResult ? (
              <p className="mt-2 text-sm text-slate-600">
                {coinResult === coinChoice ? "Your pick won." : "Your pick lost."}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {mode === "poker" ? (
        <section className="ios-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">Deal a 5-card hand for each side.</p>
            <button
              type="button"
              onClick={dealPoker}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
            >
              Deal hand
            </button>
          </div>

          <p className="text-sm text-slate-600">{pokerStatus}</p>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top side</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pokerTop.length === 0 ? <span className="text-xs text-slate-400">No cards dealt.</span> : null}
                {pokerTop.map((card, index) => (
                  <div key={`${card.label}${card.suit}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                    {card.label}{card.suit}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bottom side</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pokerBottom.length === 0 ? <span className="text-xs text-slate-400">No cards dealt.</span> : null}
                {pokerBottom.map((card, index) => (
                  <div key={`${card.label}${card.suit}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                    {card.label}{card.suit}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
