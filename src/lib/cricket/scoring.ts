export type ExtraType = "NONE" | "WD" | "NB" | "B" | "LB";
export type WicketType = "NONE" | "BOWLED" | "CAUGHT" | "RUN_OUT" | "LBW" | "STUMPED";

export type BallEvent = {
  id: string;
  runsOffBat: number;
  extraType: ExtraType;
  extraRuns: number;
  wicketType: WicketType;
  notes?: string;
  createdAt: string;
};

export type MatchConfig = {
  teamBatting: string;
  teamBowling: string;
  oversLimit: number;
};

export type MatchState = {
  config: MatchConfig;
  events: BallEvent[];
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  inningsComplete: boolean;
};

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  teamBatting: "Team A",
  teamBowling: "Team B",
  oversLimit: 6,
};

export function createMatchState(config: MatchConfig = DEFAULT_MATCH_CONFIG): MatchState {
  return computeDerived({
    config,
    events: [],
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    oversText: "0.0",
    inningsComplete: false,
  });
}

export function isLegalDelivery(extraType: ExtraType) {
  return extraType !== "WD" && extraType !== "NB";
}

export function applyBall(state: MatchState, event: BallEvent): MatchState {
  return computeDerived({ ...state, events: [...state.events, event] });
}

export function undoBall(state: MatchState): MatchState {
  if (state.events.length === 0) return state;
  return computeDerived({ ...state, events: state.events.slice(0, -1) });
}

export function editBall(state: MatchState, eventId: string, patch: Partial<BallEvent>): MatchState {
  const nextEvents = state.events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          ...patch,
        }
      : event,
  );
  return computeDerived({ ...state, events: nextEvents });
}

export function deleteBall(state: MatchState, eventId: string): MatchState {
  const nextEvents = state.events.filter((event) => event.id !== eventId);
  return computeDerived({ ...state, events: nextEvents });
}

function computeDerived(state: MatchState): MatchState {
  let totalRuns = 0;
  let wickets = 0;
  let legalBalls = 0;

  for (const event of state.events) {
    totalRuns += Math.max(0, event.runsOffBat) + Math.max(0, event.extraRuns);
    if (event.wicketType !== "NONE") wickets += 1;
    if (isLegalDelivery(event.extraType)) legalBalls += 1;
  }

  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  const inningsComplete = overs >= state.config.oversLimit;

  return {
    ...state,
    totalRuns,
    wickets,
    legalBalls,
    oversText: `${overs}.${balls}`,
    inningsComplete,
  };
}

export function generateEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBallEvent(input?: Partial<BallEvent>): BallEvent {
  return {
    id: generateEventId(),
    runsOffBat: input?.runsOffBat ?? 0,
    extraType: input?.extraType ?? "NONE",
    extraRuns: input?.extraRuns ?? 0,
    wicketType: input?.wicketType ?? "NONE",
    notes: input?.notes,
    createdAt: input?.createdAt ?? new Date().toISOString(),
  };
}
