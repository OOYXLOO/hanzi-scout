import { createRun, quadrantForIndex } from "./levels.js";

export function createGameState({ now = () => Date.now(), dayKey, rounds = 6 } = {}) {
  const run = createRun({ dayKey, rounds });
  return {
    run,
    now,
    startedAt: null,
    endsAt: null,
    currentRound: 0,
    score: 0,
    combo: 1,
    misses: 0,
    solved: [],
    hint: null,
    rewardUses: {
      hint: 0,
      extraTime: 0,
    },
    finishedReason: null,
    complete: false,
  };
}

export function startRun(state) {
  const time = state.now();
  state.startedAt = time;
  state.endsAt = time + state.run.timeLimit * 1000;
  state.currentRound = 0;
  state.score = 0;
  state.combo = 1;
  state.misses = 0;
  state.solved = [];
  state.hint = null;
  state.rewardUses = {
    hint: 0,
    extraTime: 0,
  };
  state.finishedReason = null;
  state.complete = false;
  return state;
}

export function getCurrentRound(state) {
  return state.run.rounds[state.currentRound] || null;
}

export function getRemainingSeconds(state) {
  if (!state.endsAt) {
    return state.run.timeLimit;
  }
  return Math.max(0, Math.ceil((state.endsAt - state.now()) / 1000));
}

export function tapCell(state, cellIndex) {
  if (!state.startedAt || state.complete || getRemainingSeconds(state) <= 0) {
    return { ok: false, reason: "inactive" };
  }

  const round = getCurrentRound(state);
  if (!round) {
    state.complete = true;
    return { ok: false, reason: "complete" };
  }

  const correct = cellIndex === round.targetIndex;
  if (correct) {
    const timeBonus = Math.min(40, getRemainingSeconds(state));
    const points = 100 + round.difficulty * 25 + state.combo * 15 + timeBonus;
    state.score += points;
    state.solved.push({ roundId: round.id, points, hintUsed: Boolean(state.hint) });
    state.combo += 1;
    state.currentRound += 1;
    state.hint = null;
    if (state.currentRound >= state.run.rounds.length) {
      state.complete = true;
      state.finishedReason = "cleared";
    }
    return { ok: true, correct: true, points };
  }

  state.misses += 1;
  state.combo = 1;
  state.score = Math.max(0, state.score - 20);
  return { ok: true, correct: false, points: -20 };
}

export function grantHint(state) {
  const round = getCurrentRound(state);
  if (!round || state.complete || !canUseReward(state, "hint")) {
    return null;
  }
  state.rewardUses.hint += 1;
  state.hint = {
    roundId: round.id,
    quadrant: quadrantForIndex(round.targetIndex, round.size),
  };
  return state.hint;
}

export function grantExtraTime(state, seconds = 10) {
  if (!state.startedAt || state.complete || !canUseReward(state, "extraTime")) {
    return 0;
  }
  state.rewardUses.extraTime += 1;
  state.endsAt += seconds * 1000;
  return getRemainingSeconds(state);
}

export function canUseReward(state, reason) {
  const limits = {
    hint: 2,
    extraTime: 1,
  };
  return (state.rewardUses?.[reason] || 0) < (limits[reason] || 0);
}

export function finishRun(state, reason = "ended") {
  if (state.complete) {
    return state;
  }
  state.complete = true;
  state.finishedReason = reason;
  return state;
}

export function createRunSummary(state) {
  const solved = state.solved.length;
  const total = state.run.rounds.length;
  const cleared = solved === total;
  const goal = state.run.goal;
  const goalMet = cleared && state.score >= goal.targetScore && state.misses <= goal.maxMisses;
  return {
    dayKey: state.run.dayKey,
    score: state.score,
    solved,
    total,
    cleared,
    misses: state.misses,
    bestCombo: Math.max(1, state.combo - 1),
    rewardUses: { ...state.rewardUses },
    goalMet,
    targetScore: goal.targetScore,
    maxMisses: goal.maxMisses,
    finishedReason: state.finishedReason || (cleared ? "cleared" : "ended"),
  };
}

export function createShareText(state) {
  const summary = createRunSummary(state);
  const status = summary.cleared ? "通关" : "挑战";
  const goal = summary.goalMet ? "，达成今日目标" : "";
  return `Hanzi Scout ${summary.dayKey}：${status} ${summary.solved}/${summary.total}，${summary.score} 分，最高连击 x${summary.bestCombo}${goal}。`;
}

export function createProgress(state) {
  return state.run.rounds.map((round, index) => {
    const solved = state.solved.some((entry) => entry.roundId === round.id);
    return {
      id: round.id,
      label: `${index + 1}`,
      solved,
      current: index === state.currentRound && !state.complete,
    };
  });
}
