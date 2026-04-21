import test from "node:test";
import assert from "node:assert/strict";

import { applyBall, createBallEvent, createMatchState, editBall, undoBall } from "../src/lib/cricket/scoring.ts";

test("applies legal deliveries and overs correctly", () => {
  let state = createMatchState({ teamBatting: "A", teamBowling: "B", oversLimit: 2 });

  for (let i = 0; i < 6; i += 1) {
    state = applyBall(state, createBallEvent({ runsOffBat: 1 }));
  }

  assert.equal(state.totalRuns, 6);
  assert.equal(state.legalBalls, 6);
  assert.equal(state.oversText, "1.0");
});

test("wides and no-balls add runs but do not consume legal balls", () => {
  let state = createMatchState({ teamBatting: "A", teamBowling: "B", oversLimit: 1 });

  state = applyBall(state, createBallEvent({ runsOffBat: 0, extraType: "WD", extraRuns: 1 }));
  state = applyBall(state, createBallEvent({ runsOffBat: 0, extraType: "NB", extraRuns: 1 }));

  assert.equal(state.totalRuns, 2);
  assert.equal(state.legalBalls, 0);
  assert.equal(state.oversText, "0.0");
});

test("undo and edit recompute state deterministically", () => {
  let state = createMatchState({ teamBatting: "A", teamBowling: "B", oversLimit: 1 });

  const e1 = createBallEvent({ runsOffBat: 4 });
  const e2 = createBallEvent({ runsOffBat: 0, wicketType: "BOWLED" });
  state = applyBall(state, e1);
  state = applyBall(state, e2);

  assert.equal(state.totalRuns, 4);
  assert.equal(state.wickets, 1);

  state = editBall(state, e1.id, { runsOffBat: 6 });
  assert.equal(state.totalRuns, 6);

  state = undoBall(state);
  assert.equal(state.wickets, 0);
  assert.equal(state.totalRuns, 6);
});
