"use client";

import { Chess } from "chess.js";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckersLoader } from "@/components/CheckersLoader";
import {
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatPill,
} from "@/components/product/ProductUI";
import { fetchClientApi, normalizeClientError } from "@/lib/client-api";
import {
  duelResultSummary,
  normalizeDuelState,
  type CheckersDuelState,
  type CheckersPos,
  type ChessDuelState,
  type CoinDuelState,
  type DuelParty,
  type PokerDuelState,
  type TradeDuelState,
} from "@/lib/duels";
import {
  formatTradeDateTime,
  type TradeDuelItem,
  type TradeOfferItem,
} from "@/lib/trade-client";

type DuelPayload = {
  offer: TradeOfferItem;
  duel: TradeDuelItem;
  viewerRole: DuelParty | null;
  duelStatus: TradeDuelItem["status"];
};

function partyLabel(party: DuelParty | null | undefined) {
  if (party === "CHALLENGER") return "Challenger";
  if (party === "DEFENDER") return "Defender";
  return "Viewer";
}

function roleForUser(duel: TradeDuelItem, userId: string | null | undefined) {
  if (!userId) return null;
  if (duel.challengerId === userId) return "CHALLENGER" as const;
  if (duel.defenderId === userId) return "DEFENDER" as const;
  return null;
}

function formatCountdown(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return "Untimed";
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return "Untimed";
  const remaining = deadline.getTime() - Date.now();
  if (remaining <= 0) return "Expired";
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} left`;
}

function statusLabel(status: TradeDuelItem["status"]) {
  if (status === "READY") return "Ready";
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "ACTIVE") return "Live";
  if (status === "COMPLETED") return "Completed";
  return status.toLowerCase();
}

export default function TradeDuelPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const tradeId = useMemo(() => (Array.isArray(params.id) ? params.id[0] : params.id), [params.id]);
  const offerId = searchParams.get("offer") ?? "";

  const [payload, setPayload] = useState<DuelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [selectedCheckers, setSelectedCheckers] = useState<CheckersPos | null>(null);
  const [selectedChess, setSelectedChess] = useState<string | null>(null);

  const load = async (options?: { silent?: boolean }) => {
    if (!offerId) return;
    if (!options?.silent) setLoading(true);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/offers/${encodeURIComponent(offerId)}/duel`, { cache: "no-store" });
      const next = (await response.json()) as DuelPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Unable to load duel.");
      setPayload(next);
      if (!options?.silent) setLoading(false);
    } catch (loadError) {
      setError(normalizeClientError(loadError, "Unable to load duel."));
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return undefined;
    const intervalId = window.setInterval(() => {
      void load({ silent: true });
    }, 4000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  useEffect(() => {
    setSelectedCheckers(null);
    setSelectedChess(null);
  }, [payload?.duel?.stateVersion]);

  const performAction = async (body: Record<string, unknown>) => {
    if (!offerId) return;
    setActing(true);
    setError("");
    try {
      const response = await fetchClientApi(`/api/trades/offers/${encodeURIComponent(offerId)}/duel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = (await response.json()) as DuelPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Unable to update duel.");
      setPayload(next);
    } catch (actionError) {
      setError(normalizeClientError(actionError, "Unable to update duel."));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <CheckersLoader title="Loading duel..." compact />;
  }

  if (!payload) {
    return (
      <PageContainer className="trade-duel-page app-page--trade-duel">
        <section className="app-section">
          <div>
            <div className="product-card trade-detail-empty-state">
              <h2>Duel unavailable</h2>
              <p>{error || "This duel could not be loaded right now."}</p>
              <div className="trade-detail-head-actions">
                <SecondaryButton href={`/trades/${encodeURIComponent(tradeId)}`}>Back to trade</SecondaryButton>
                <PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>
              </div>
            </div>
          </div>
        </section>
      </PageContainer>
    );
  }

  const { offer, duel, viewerRole, duelStatus } = payload;
  const duelState = normalizeDuelState(duel.mode, duel.state) as TradeDuelState;
  const currentUserId = session?.user?.id ?? null;
  const currentRole = roleForUser(duel, currentUserId);
  const ownerAgreed = duel.challengerId === offer.post.ownerId ? Boolean(duel.challengerAgreedAt) : Boolean(duel.defenderAgreedAt);
  const proposerAgreed = duel.challengerId === offer.proposerId ? Boolean(duel.challengerAgreedAt) : Boolean(duel.defenderAgreedAt);
  const viewerAgreed = currentRole === "CHALLENGER" ? Boolean(duel.challengerAgreedAt) : currentRole === "DEFENDER" ? Boolean(duel.defenderAgreedAt) : true;
  const canApprove = Boolean(currentRole) && !viewerAgreed && duelStatus !== "COMPLETED";
  const canStart = Boolean(currentRole) && (duelStatus === "READY" || (duelStatus === "SCHEDULED" && duel.scheduledFor && new Date(duel.scheduledFor).getTime() <= Date.now()));
  const canAct = duelStatus === "ACTIVE" && currentRole !== null && duel.completedAt === null;

  const boardRows = currentRole === "DEFENDER"
    ? Array.from({ length: 8 }, (_, index) => index)
    : Array.from({ length: 8 }, (_, index) => 7 - index);
  const boardCols = currentRole === "DEFENDER"
    ? Array.from({ length: 8 }, (_, index) => 7 - index)
    : Array.from({ length: 8 }, (_, index) => index);

  const renderCheckers = (state: CheckersDuelState) => (
    <section className="product-card trade-duel-panel">
      <SectionHeader
        title="Checkers"
        subtitle={state.note}
        action={<span className="market-count">{partyLabel(state.turn)} to move</span>}
      />
      <div className="trade-duel-board trade-duel-board--checkers">
        {boardRows.map((r) => boardCols.map((c) => {
          const cell = state.board[r]?.[c] ?? null;
          const selected = selectedCheckers?.r === r && selectedCheckers?.c === c;
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              disabled={!canAct}
              onClick={() => {
                if (!canAct || currentRole === null) return;
                if (selectedCheckers) {
                  void performAction({
                    action: "MOVE_CHECKERS",
                    stateVersion: duel.stateVersion,
                    from: selectedCheckers,
                    to: { r, c },
                  });
                  return;
                }
                if (cell && cell.party === currentRole) {
                  setSelectedCheckers({ r, c });
                }
              }}
              className={`trade-duel-square ${(r + c) % 2 === 0 ? "is-light" : "is-dark"} ${selected ? "is-selected" : ""}`}
            >
              {cell ? (
                <span className={`trade-duel-piece ${cell.party === "CHALLENGER" ? "is-challenger" : "is-defender"} ${cell.king ? "is-king" : ""}`} />
              ) : null}
            </button>
          );
        }))}
      </div>
      {selectedCheckers ? (
        <button type="button" className="trade-duel-clear" onClick={() => setSelectedCheckers(null)}>
          Clear selection
        </button>
      ) : null}
    </section>
  );

  const renderChess = (state: ChessDuelState) => {
    const chess = new Chess(state.fen);
    const board = chess.board();

    return (
      <section className="product-card trade-duel-panel">
        <SectionHeader
          title="Chess"
          subtitle={state.note}
          action={<span className="market-count">{partyLabel(state.turn)} to move</span>}
        />
        <div className="trade-duel-board trade-duel-board--chess">
          {boardRows.map((r) => boardCols.map((c) => {
            const piece = board[r]?.[c];
            const square = `${String.fromCharCode(97 + c)}${8 - r}`;
            const selected = selectedChess === square;
            return (
              <button
                key={square}
                type="button"
                disabled={!canAct}
                onClick={() => {
                  if (!canAct) return;
                  if (selectedChess) {
                    void performAction({ action: "MOVE_CHESS", stateVersion: duel.stateVersion, from: selectedChess, to: square });
                    return;
                  }
                  const pieceParty = piece?.color === "w" ? "CHALLENGER" : piece?.color === "b" ? "DEFENDER" : null;
                  if (piece && pieceParty === currentRole) {
                    setSelectedChess(square);
                  }
                }}
                className={`trade-duel-square ${(r + c) % 2 === 0 ? "is-light" : "is-dark"} ${selected ? "is-selected" : ""}`}
              >
                {piece ? (
                  <span className={`trade-duel-chess-piece ${piece.color === "w" ? "is-challenger" : "is-defender"}`}>
                    {piece.type.toUpperCase()}
                  </span>
                ) : null}
              </button>
            );
          }))}
        </div>
        {state.lastMove ? <p className="trade-duel-footnote">Last move: {state.lastMove}</p> : null}
      </section>
    );
  };

  const renderCoin = (state: CoinDuelState) => (
    <section className="product-card trade-duel-panel">
      <SectionHeader title="Coin flip" subtitle={state.note} />
      <div className="trade-duel-instant">
        <div className="trade-duel-result-mark">{state.result ?? "?"}</div>
        {state.result ? (
          <p className="trade-duel-footnote">{state.note}</p>
        ) : (
          <PrimaryButton onClick={() => void performAction({ action: "RESOLVE_COIN", stateVersion: duel.stateVersion })} disabled={!canAct || acting}>
            {acting ? "Flipping..." : "Flip coin"}
          </PrimaryButton>
        )}
      </div>
    </section>
  );

  const renderPoker = (state: PokerDuelState) => (
    <section className="product-card trade-duel-panel">
      <SectionHeader title="Poker" subtitle={state.note} />
      <div className="trade-duel-poker-grid">
        <article>
          <p className="trade-duel-eyebrow">Challenger</p>
          <p className="trade-duel-poker-hand">{state.challengerHand.map((card) => `${card.label}${card.suit}`).join(" ") || "Undealt"}</p>
          {state.challengerScore ? <p className="trade-duel-footnote">{state.challengerScore}</p> : null}
        </article>
        <article>
          <p className="trade-duel-eyebrow">Defender</p>
          <p className="trade-duel-poker-hand">{state.defenderHand.map((card) => `${card.label}${card.suit}`).join(" ") || "Undealt"}</p>
          {state.defenderScore ? <p className="trade-duel-footnote">{state.defenderScore}</p> : null}
        </article>
      </div>
      {state.winner ? null : (
        <PrimaryButton onClick={() => void performAction({ action: "RESOLVE_POKER", stateVersion: duel.stateVersion })} disabled={!canAct || acting}>
          {acting ? "Dealing..." : "Deal hands"}
        </PrimaryButton>
      )}
    </section>
  );

  return (
    <PageContainer className="trade-duel-page app-page--trade-duel">
      <section className="app-section trade-duel-screen">
        <PageHeader
          eyebrow="Trade duel"
          title={offer.post.title}
          subtitle={`${statusLabel(duelStatus)} · ${formatTradeDateTime(offer.createdAt)}`}
          actions={(
            <div className="trade-detail-head-actions">
              <SecondaryButton href={`/trades/${encodeURIComponent(tradeId)}`}>Back to trade</SecondaryButton>
            </div>
          )}
        />

        {error ? <p className="app-status-note is-error">{error}</p> : null}

        <section className="trade-duel-layout">
          <div className="trade-duel-main">
            {duelState.kind === "checkers" ? renderCheckers(duelState) : null}
            {duelState.kind === "chess" ? renderChess(duelState) : null}
            {duelState.kind === "coin" ? renderCoin(duelState) : null}
            {duelState.kind === "poker" ? renderPoker(duelState) : null}
          </div>

          <aside className="trade-duel-sidebar">
            <section className="product-card trade-duel-panel">
              <SectionHeader title="Terms" subtitle="Dalow validates the duel and resolves the trade automatically." />
              <p className="trade-duel-copy">{duel.terms}</p>
              <div className="trade-duel-stats">
                <StatPill label="Mode" value={duel.mode} />
                <StatPill label="Clock" value={formatCountdown(duel.deadlineAt)} />
                <StatPill label="Status" value={statusLabel(duelStatus)} />
              </div>
              {duel.scheduledFor ? (
                <p className="trade-duel-footnote">Scheduled for {formatTradeDateTime(duel.scheduledFor)}</p>
              ) : null}
              <div className="trade-duel-approval-list">
                <span className={ownerAgreed ? "is-ready" : ""}>Owner {ownerAgreed ? "ready" : "pending"}</span>
                <span className={proposerAgreed ? "is-ready" : ""}>Proposer {proposerAgreed ? "ready" : "pending"}</span>
              </div>
              {canApprove ? (
                <PrimaryButton onClick={() => void performAction({ action: "AGREE" })} disabled={acting}>
                  {acting ? "Saving..." : "Approve duel"}
                </PrimaryButton>
              ) : null}
              {canStart ? (
                <PrimaryButton onClick={() => void performAction({ action: "START" })} disabled={acting}>
                  {acting ? "Starting..." : "Start duel"}
                </PrimaryButton>
              ) : null}
              {!canApprove && !canStart && duelStatus !== "ACTIVE" && duelStatus !== "COMPLETED" ? (
                <p className="trade-duel-footnote">Waiting for both collectors to approve and enter the duel room.</p>
              ) : null}
            </section>

            <section className="product-card trade-duel-panel">
              <SectionHeader title="Participants" />
              <div className="trade-duel-participant">
                <strong>{duel.challenger.displayName ?? duel.challenger.username ?? "Challenger"}</strong>
                <span>Challenger · pushing the counter terms</span>
              </div>
              <div className="trade-duel-participant">
                <strong>{duel.defender.displayName ?? duel.defender.username ?? "Defender"}</strong>
                <span>Defender · protecting the prior terms</span>
              </div>
              <p className="trade-duel-footnote">
                If the challenger wins, the counter terms are accepted automatically. If the defender wins, the prior terms stand and the trade resolves on those terms.
              </p>
            </section>

            <section className="product-card trade-duel-panel">
              <SectionHeader title="Result" />
              <p className="trade-duel-copy">{duelResultSummary(duel.mode, duelState)}</p>
              {duel.winner ? (
                <p className="trade-duel-result">
                  Winner: {duel.winner.displayName ?? duel.winner.username ?? partyLabel(viewerRole)}
                </p>
              ) : (
                <p className="trade-duel-footnote">Dalow will settle the trade the moment the duel produces a winner.</p>
              )}
            </section>
          </aside>
        </section>
      </section>
    </PageContainer>
  );
}
