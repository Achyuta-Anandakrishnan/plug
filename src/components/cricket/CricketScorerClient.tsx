"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyBall,
  createBallEvent,
  createMatchState,
  deleteBall,
  editBall,
  type ExtraType,
  type MatchConfig,
  type MatchState,
  type WicketType,
  undoBall,
} from "@/lib/cricket/scoring";

const STORAGE_KEY = "cricket_scorer_state_v1";

const runButtons = [0, 1, 2, 3, 4, 6] as const;

export function CricketScorerClient() {
  const [config, setConfig] = useState<MatchConfig>({
    teamBatting: "Team A",
    teamBowling: "Team B",
    oversLimit: 6,
  });
  const [state, setState] = useState<MatchState>(createMatchState({
    teamBatting: "Team A",
    teamBowling: "Team B",
    oversLimit: 6,
  }));
  const [started, setStarted] = useState(false);


  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        started,
        state,
      }),
    );
  }, [started, state]);

  const requiredRate = useMemo(() => {
    if (!state.config.oversLimit) return "0.00";
    const totalBalls = state.config.oversLimit * 6;
    const ballsLeft = Math.max(0, totalBalls - state.legalBalls);
    if (!ballsLeft) return "0.00";
    const parTarget = state.config.oversLimit * 8;
    const runsNeeded = Math.max(0, parTarget - state.totalRuns);
    return (runsNeeded / (ballsLeft / 6)).toFixed(2);
  }, [state]);

  function startMatch() {
    setStarted(true);
    setState(createMatchState(config));
  }

  function logBall(runsOffBat: number, extraType: ExtraType = "NONE", wicketType: WicketType = "NONE") {
    if (!started || state.inningsComplete) return;
    const extraRuns = extraType === "WD" || extraType === "NB" ? 1 : 0;
    setState((current) =>
      applyBall(
        current,
        createBallEvent({
          runsOffBat,
          extraType,
          extraRuns,
          wicketType,
        }),
      ),
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3bc7ff33,#0a1022_45%,#05070f)] p-6 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">AI Cricket Scoring Cam</p>
          <h1 className="mt-2 text-3xl font-semibold">Live Match Control</h1>
          <p className="mt-1 text-sm text-white/80">
            Glassmorphism scorer surface with AI-ready event logging, manual correction, and over tracking.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <Label>Batting Team</Label>
            <input
              value={config.teamBatting}
              onChange={(event) => setConfig((prev) => ({ ...prev, teamBatting: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 outline-none ring-cyan-300/60 transition focus:ring"
            />
          </Card>

          <Card>
            <Label>Bowling Team</Label>
            <input
              value={config.teamBowling}
              onChange={(event) => setConfig((prev) => ({ ...prev, teamBowling: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 outline-none ring-cyan-300/60 transition focus:ring"
            />
          </Card>

          <Card>
            <Label>Overs</Label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.oversLimit}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, oversLimit: Math.max(1, Number(event.target.value) || 1) }))
              }
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 outline-none ring-cyan-300/60 transition focus:ring"
            />
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard title="Score" value={`${state.totalRuns}/${state.wickets}`} />
          <StatCard title="Overs" value={state.oversText} />
          <StatCard title="Balls Logged" value={String(state.events.length)} />
          <StatCard title="Req RR (Par)" value={requiredRate} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Scoring Pad</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={startMatch}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300"
                >
                  {started ? "Restart Match" : "Start Match"}
                </button>
                <button
                  onClick={() => setState((current) => undoBall(current))}
                  className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
                  disabled={!state.events.length}
                >
                  Undo Ball
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {runButtons.map((runs) => (
                <button
                  key={runs}
                  onClick={() => logBall(runs)}
                  disabled={!started || state.inningsComplete}
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold transition enabled:hover:bg-white/20 disabled:opacity-50"
                >
                  {runs}
                </button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => logBall(0, "WD")}
                disabled={!started || state.inningsComplete}
                className="rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm transition enabled:hover:bg-amber-300/20 disabled:opacity-50"
              >
                Wide (+1)
              </button>
              <button
                onClick={() => logBall(0, "NB")}
                disabled={!started || state.inningsComplete}
                className="rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm transition enabled:hover:bg-amber-300/20 disabled:opacity-50"
              >
                No Ball (+1)
              </button>
              <button
                onClick={() => logBall(0, "NONE", "BOWLED")}
                disabled={!started || state.inningsComplete}
                className="rounded-xl border border-rose-200/30 bg-rose-300/10 px-3 py-2 text-sm transition enabled:hover:bg-rose-300/20 disabled:opacity-50"
              >
                Wicket: Bowled
              </button>
              <button
                onClick={() => logBall(0, "NONE", "CAUGHT")}
                disabled={!started || state.inningsComplete}
                className="rounded-xl border border-rose-200/30 bg-rose-300/10 px-3 py-2 text-sm transition enabled:hover:bg-rose-300/20 disabled:opacity-50"
              >
                Wicket: Caught
              </button>
            </div>

            {state.inningsComplete ? (
              <p className="rounded-xl border border-emerald-200/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                Innings complete at {state.oversText}. You can still edit or delete balls below.
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-medium">Ball Timeline</h2>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {state.events.length === 0 ? (
                <p className="rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white/70">No balls logged yet.</p>
              ) : null}
              {state.events.map((event, idx) => (
                <div key={event.id} className="rounded-xl border border-white/15 bg-black/20 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">Ball #{idx + 1}</p>
                      <p className="text-white/70">
                        Bat: {event.runsOffBat}, Extra: {event.extraType} ({event.extraRuns}), Wicket: {event.wicketType}
                      </p>
                    </div>
                    <button
                      onClick={() => setState((current) => deleteBall(current, event.id))}
                      className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => setState((current) => editBall(current, event.id, { runsOffBat: Math.max(0, event.runsOffBat - 1) }))}
                      className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/15"
                    >
                      -1 run
                    </button>
                    <button
                      onClick={() => setState((current) => editBall(current, event.id, { runsOffBat: event.runsOffBat + 1 }))}
                      className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/15"
                    >
                      +1 run
                    </button>
                    <button
                      onClick={() =>
                        setState((current) =>
                          editBall(current, event.id, {
                            wicketType: event.wicketType === "NONE" ? "CAUGHT" : "NONE",
                          }),
                        )
                      }
                      className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/15"
                    >
                      Toggle Wicket
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-2xl ${className}`}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.2em] text-white/70">{children}</p>;
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.2em] text-white/70">{title}</p>
      <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
    </Card>
  );
}
