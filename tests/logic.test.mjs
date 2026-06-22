import assert from "node:assert/strict";
import { canOfferRevive, canUseReward, createGameState, createProgress, createRunSummary, createShareText, finishRun, getCurrentRound, getRemainingSeconds, grantExtraTime, grantHint, grantRevive, pauseForRevive, startRun, tapCell } from "../src/game.js";
import { createDailyGoal, createRound, createRun, quadrantForIndex } from "../src/levels.js";
import { createFriendLeaderboard, createScoreCard, loadProfile, recordRun, saveProfile } from "../src/profile.js";
import { createPlatformAdapter } from "../src/wechat-adapter.js";

let time = Date.parse("2026-06-21T00:00:00.000Z");
const state = createGameState({
  dayKey: "2026-06-21",
  now: () => time,
});

assert.equal(state.run.rounds.length, 6);
assert.equal(typeof state.run.goal.targetScore, "number");
assert.equal(getRemainingSeconds(state), 60);
assert.equal(createRun({ dayKey: "2026-06-21" }).rounds[0].targetIndex, createRun({ dayKey: "2026-06-21" }).rounds[0].targetIndex);
assert.deepEqual(createDailyGoal({ dayKey: "2026-06-21" }), createDailyGoal({ dayKey: "2026-06-21" }));

startRun(state);
const first = getCurrentRound(state);
assert.equal(first.cells.filter((cell) => cell.target).length, 1);
assert.equal(first.cells[first.targetIndex].glyph, first.pair.target);
assert.equal(grantHint(state).quadrant, quadrantForIndex(first.targetIndex, first.size));
assert.equal(state.rewardUses.hint, 1);

const missIndex = first.targetIndex === 0 ? 1 : 0;
assert.equal(tapCell(state, missIndex).correct, false);
assert.equal(state.combo, 1);
assert.equal(tapCell(state, first.targetIndex).correct, true);
assert.equal(state.currentRound, 1);
assert.equal(state.solved.length, 1);
assert.equal(createProgress(state)[0].solved, true);
assert.match(createShareText(state), /Hanzi Scout 2026-06-21/);

time += 15_000;
const remainingBefore = getRemainingSeconds(state);
grantExtraTime(state, 10);
assert.equal(getRemainingSeconds(state), remainingBefore + 10);
assert.equal(canUseReward(state, "extraTime"), false);
assert.equal(canUseReward(state, "revive"), true);

time = state.endsAt;
assert.equal(pauseForRevive(state), true);
assert.equal(state.awaitingRevive, true);
assert.equal(canOfferRevive(state), true);
assert.equal(grantRevive(state, 15), 15);
assert.equal(state.awaitingRevive, false);
assert.equal(state.rewardUses.revive, 1);
assert.equal(canUseReward(state, "revive"), false);
finishRun(state, "timeout");
const summary = createRunSummary(state);
assert.equal(summary.finishedReason, "timeout");
assert.equal(summary.solved, 1);
assert.equal(summary.rewardUses.revive, 1);
assert.match(createShareText(state), /Hanzi Scout 2026-06-21/);

const adapter = createPlatformAdapter({ wxApi: null });
assert.equal(adapter.isWeChat, false);
assert.equal((await adapter.showRewarded("hint")).ok, true);
assert.ok(adapter.storage === null || typeof adapter.storage.getItem === "function");

const storage = createMemoryStorage();
let profile = loadProfile({ storage });
profile = recordRun(profile, summary);
assert.equal(profile.plays, 1);
assert.equal(profile.streak, 1);
assert.equal(profile.bestScore, summary.score);
assert.equal(profile.rewardViews.revive, 1);
assert.equal(saveProfile(profile, { storage }), true);
assert.equal(loadProfile({ storage }).bestScore, summary.score);
assert.match(createScoreCard(profile, summary).record, /Best/);
const leaderboard = createFriendLeaderboard(profile, summary);
assert.equal(leaderboard.length, 5);
assert.equal(leaderboard.filter((entry) => entry.isPlayer).length, 1);
assert.ok(leaderboard.every((entry, index) => entry.rank === index + 1));
assert.deepEqual(
  createFriendLeaderboard(profile, summary).map((entry) => entry.score),
  leaderboard.map((entry) => entry.score),
);

const round = createRound({ dayKey: "2026-06-21", index: 3 });
assert.equal(round.cells.length, 36);
assert.ok(round.pair.label.length > 0);

console.log("hanzi scout logic tests passed");

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
