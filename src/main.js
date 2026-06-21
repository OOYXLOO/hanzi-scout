import { canUseReward, createGameState, createProgress, createRunSummary, createShareText, finishRun, getCurrentRound, getRemainingSeconds, grantExtraTime, grantHint, startRun, tapCell } from "./game.js";
import { getDayKey } from "./levels.js";
import { createFriendLeaderboard, createScoreCard, loadProfile, recordRun, saveProfile } from "./profile.js";
import { createPlatformAdapter } from "./wechat-adapter.js";

const refs = {
  grid: document.querySelector("#grid"),
  time: document.querySelector("#time-value"),
  target: document.querySelector("#target-value"),
  decoy: document.querySelector("#decoy-value"),
  round: document.querySelector("#round-value"),
  score: document.querySelector("#score-value"),
  combo: document.querySelector("#combo-value"),
  status: document.querySelector("#status-line"),
  start: document.querySelector("#start-button"),
  hint: document.querySelector("#hint-button"),
  timeButton: document.querySelector("#time-button"),
  assist: document.querySelector("#assist-line"),
  share: document.querySelector("#share-button"),
  shareText: document.querySelector("#share-text"),
  progress: document.querySelector("#progress-list"),
  daily: document.querySelector("#daily-line"),
  goal: document.querySelector("#goal-line"),
  profile: document.querySelector("#profile-line"),
  resultCard: document.querySelector("#result-card"),
  leaderboard: document.querySelector("#leaderboard-list"),
};

const platform = createPlatformAdapter();
const state = createGameState({ dayKey: getDayKey() });
let profile = loadProfile({ storage: platform.storage });
let timer = null;
let recordedRunKey = null;
let interstitialRunKey = null;

refs.daily.textContent = `每日种子 ${state.run.dayKey}。6 个棋盘，每盘 1 个不同字。`;
refs.goal.textContent = formatGoal();
refs.profile.textContent = formatProfile();
render();

refs.start.addEventListener("click", () => {
  startRun(state);
  recordedRunKey = null;
  interstitialRunKey = null;
  refs.status.textContent = "在倒计时结束前找出不同的汉字。";
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (getRemainingSeconds(state) <= 0 && !state.complete) {
      finishRun(state, "timeout");
    }
    if (state.complete) {
      window.clearInterval(timer);
      timer = null;
    }
    render();
  }, 250);
  render();
});

refs.hint.addEventListener("click", async () => {
  if (!canUseReward(state, "hint")) {
    refs.status.textContent = "本局提示次数已用完。";
    render();
    return;
  }
  refs.hint.disabled = true;
  refs.status.textContent = "正在打开提示奖励...";
  const reward = await platform.showRewarded("hint");
  if (reward.ok) {
    const hint = grantHint(state);
    refs.status.textContent = hint ? `提示：目标在 ${translateQuadrant(hint.quadrant)}。` : "当前没有可提示的轮次。";
  } else {
    refs.status.textContent = "提示奖励没有完成。";
  }
  refs.hint.disabled = false;
  render();
});

refs.timeButton.addEventListener("click", async () => {
  if (!canUseReward(state, "extraTime")) {
    refs.status.textContent = "本局加时次数已用完。";
    render();
    return;
  }
  refs.timeButton.disabled = true;
  refs.status.textContent = "正在打开加时奖励...";
  const reward = await platform.showRewarded("extra-time");
  if (reward.ok) {
    grantExtraTime(state, 10);
    refs.status.textContent = "已增加 10 秒。";
  } else {
    refs.status.textContent = "加时奖励没有完成。";
  }
  refs.timeButton.disabled = false;
  render();
});

refs.share.addEventListener("click", async () => {
  const text = createShareText(state);
  refs.shareText.value = text;
  if (!platform.share(text) && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    refs.share.textContent = "已复制";
    window.setTimeout(() => {
      refs.share.textContent = "分享成绩";
    }, 1000);
  }
});

function render() {
  const round = getCurrentRound(state);
  refs.time.textContent = String(getRemainingSeconds(state));
  refs.score.textContent = String(state.score);
  refs.combo.textContent = `x${state.combo}`;
  refs.round.textContent = `${Math.min(state.currentRound + 1, state.run.rounds.length)}/${state.run.rounds.length}`;
  refs.shareText.value = createShareText(state);
  refs.goal.textContent = formatGoal();
  refs.profile.textContent = formatProfile();
  refs.assist.textContent = formatAssist();
  renderLeaderboard(createRunSummary(state));
  refs.hint.disabled = !state.startedAt || state.complete || !canUseReward(state, "hint");
  refs.timeButton.disabled = !state.startedAt || state.complete || !canUseReward(state, "extraTime");
  renderProgress();

  if (state.complete || !round) {
    const summary = recordCompletion();
    const scoreCard = createScoreCard(profile, summary);
    refs.grid.replaceChildren();
    refs.status.textContent = `${scoreCard.headline}。${scoreCard.details}。`;
    refs.resultCard.textContent = scoreCard.record;
    showEndInterstitialOnce();
    return;
  }

  refs.resultCard.textContent = "";
  refs.target.textContent = round.pair.target;
  refs.decoy.textContent = round.pair.decoy;
  refs.grid.style.setProperty("--grid-size", round.size);
  refs.grid.replaceChildren(
    ...round.cells.map((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `glyph-cell${state.hint && hintMatches(index, round) ? " hinted" : ""}`;
      button.textContent = cell.glyph;
      button.setAttribute("aria-label", `cell ${index + 1}`);
      button.disabled = !state.startedAt;
      button.addEventListener("click", () => {
        const result = tapCell(state, index);
        if (result.correct) {
          refs.status.textContent = `正确 +${result.points}。`;
        } else if (result.ok) {
          refs.status.textContent = "点错了，连击重置。";
        }
        render();
      });
      return button;
    }),
  );
}

function renderLeaderboard(summary) {
  refs.leaderboard.replaceChildren(
    ...createFriendLeaderboard(profile, summary).map((entry) => {
      const li = document.createElement("li");
      li.className = entry.isPlayer ? "player" : "";
      li.innerHTML = `<span>${entry.rank}. ${entry.name}</span><strong>${entry.score}</strong><em>${entry.solved}/6</em>`;
      return li;
    }),
  );
}

function recordCompletion() {
  const summary = createRunSummary(state);
  const key = `${state.startedAt || "preview"}:${summary.dayKey}:${summary.finishedReason}`;
  if (state.startedAt && recordedRunKey !== key) {
    profile = recordRun(profile, summary);
    saveProfile(profile, { storage: platform.storage });
    recordedRunKey = key;
  }
  return summary;
}

function showEndInterstitialOnce() {
  const key = `${state.startedAt || "preview"}:${state.run.dayKey}`;
  if (!state.startedAt || interstitialRunKey === key) return;
  interstitialRunKey = key;
  platform.showInterstitial();
}

function formatGoal() {
  const goal = state.run.goal;
  return `目标 ${goal.targetScore} 分以内，错点不超过 ${goal.maxMisses} 次；今日观察点：${goal.focus}。`;
}

function formatAssist() {
  return `提示 ${state.rewardUses.hint}/2，加时 ${state.rewardUses.extraTime}/1。浏览器模式只模拟完成。`;
}

function formatProfile() {
  const best = profile.bestScore ? `${profile.bestScore} 分（${profile.bestDay}）` : "暂无";
  return `最佳 ${best}；连续挑战 ${profile.streak} 天；已玩 ${profile.plays} 局。`;
}

function translateQuadrant(value) {
  return {
    "upper left": "左上区域",
    "upper right": "右上区域",
    "lower left": "左下区域",
    "lower right": "右下区域",
  }[value] || value;
}

function hintMatches(index, round) {
  if (!state.hint) return false;
  const row = Math.floor(index / round.size);
  const col = index % round.size;
  const targetUpper = state.hint.quadrant.includes("upper");
  const targetLeft = state.hint.quadrant.includes("left");
  return (targetUpper ? row < round.size / 2 : row >= round.size / 2) && (targetLeft ? col < round.size / 2 : col >= round.size / 2);
}

function renderProgress() {
  refs.progress.replaceChildren(
    ...createProgress(state).map((item) => {
      const li = document.createElement("li");
      li.className = `${item.solved ? "solved" : ""} ${item.current ? "current" : ""}`;
      li.textContent = item.label;
      li.setAttribute("aria-label", `round ${item.label}: ${item.solved ? "solved" : item.current ? "current" : "open"}`);
      return li;
    }),
  );
}
