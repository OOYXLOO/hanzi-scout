import {
  canOfferRevive,
  canUseReward,
  createGameState,
  createProgress,
  createRunSummary,
  createShareText,
  finishRun,
  getCurrentRound,
  getRemainingSeconds,
  grantExtraTime,
  grantHint,
  grantRevive,
  pauseForRevive,
  startRun,
  tapCell,
} from "./game.js";
import { getDayKey } from "./levels.js";
import { createFriendLeaderboard, createScoreCard, createEmptyProfile, loadProfile, recordRun, saveProfile } from "./profile.js";
import { createPlatformAdapter } from "./wechat-adapter.js";

export const CANVAS_ACTIONS = {
  START: "start",
  HINT: "hint",
  EXTRA_TIME: "extraTime",
  REVIVE: "revive",
  SHARE: "share",
};

const COLORS = {
  background: "#f6f2ea",
  panel: "#fffdf8",
  ink: "#1f2933",
  muted: "#687385",
  line: "#d8cec0",
  accent: "#0f766e",
  accentSoft: "#d8f3ec",
  warn: "#b45309",
  wrong: "#b91c1c",
  target: "#111827",
  decoy: "#374151",
  disabled: "#c8c0b4",
};

export function createCanvasLayout({ width = 390, height = 844, roundSize = 6, safeTop = 0 } = {}) {
  const margin = Math.max(16, Math.round(width * 0.045));
  const headerTop = safeTop + 18;
  const gridSize = Math.min(width - margin * 2, Math.max(240, height * 0.45));
  const gridX = Math.round((width - gridSize) / 2);
  const gridY = Math.round(Math.max(170 + safeTop, height * 0.23));
  const cellSize = gridSize / roundSize;
  const buttonHeight = 44;
  const gap = 10;
  const buttonY = Math.min(height - 152, gridY + gridSize + 22);
  const smallWidth = Math.floor((width - margin * 2 - gap * 2) / 3);

  return {
    width,
    height,
    margin,
    header: { x: margin, y: headerTop, width: width - margin * 2, height: 132 },
    grid: { x: gridX, y: gridY, size: gridSize, cellSize, roundSize },
    buttons: [
      { action: CANVAS_ACTIONS.START, label: "开始", x: margin, y: buttonY, width: width - margin * 2, height: buttonHeight, primary: true },
      { action: CANVAS_ACTIONS.HINT, label: "提示", x: margin, y: buttonY + buttonHeight + gap, width: smallWidth, height: buttonHeight },
      { action: CANVAS_ACTIONS.EXTRA_TIME, label: "加时", x: margin + smallWidth + gap, y: buttonY + buttonHeight + gap, width: smallWidth, height: buttonHeight },
      { action: CANVAS_ACTIONS.REVIVE, label: "复活", x: margin + (smallWidth + gap) * 2, y: buttonY + buttonHeight + gap, width: smallWidth, height: buttonHeight },
      { action: CANVAS_ACTIONS.SHARE, label: "分享", x: margin, y: buttonY + (buttonHeight + gap) * 2, width: width - margin * 2, height: buttonHeight },
    ],
    footer: { x: margin, y: buttonY + (buttonHeight + gap) * 3, width: width - margin * 2, height: Math.max(70, height - buttonY - (buttonHeight + gap) * 3 - 12) },
  };
}

export function hitTestCanvasLayout(layout, point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const { grid } = layout;
  if (x >= grid.x && x <= grid.x + grid.size && y >= grid.y && y <= grid.y + grid.size) {
    const col = Math.min(grid.roundSize - 1, Math.floor((x - grid.x) / grid.cellSize));
    const row = Math.min(grid.roundSize - 1, Math.floor((y - grid.y) / grid.cellSize));
    return { type: "cell", index: row * grid.roundSize + col, row, col };
  }

  for (const button of layout.buttons) {
    if (x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) {
      return { type: "action", action: button.action };
    }
  }

  return null;
}

export function createCanvasGameShell({
  canvas,
  context = canvas?.getContext?.("2d"),
  platform = createPlatformAdapter(),
  now = () => Date.now(),
  state = createGameState({ dayKey: getDayKey(), now }),
  profile = loadProfile({ storage: platform.storage }),
  width = canvas?.width || 390,
  height = canvas?.height || 844,
} = {}) {
  let status = "每日找字挑战。";
  let recordedRunKey = null;
  let interstitialRunKey = null;
  let layout = createCanvasLayout({ width, height, roundSize: getCurrentRound(state)?.size || 6 });

  const shell = {
    state,
    get profile() {
      return profile;
    },
    get status() {
      return status;
    },
    get layout() {
      return layout;
    },
    resize(nextWidth = width, nextHeight = height) {
      width = nextWidth;
      height = nextHeight;
      layout = createCanvasLayout({ width, height, roundSize: getCurrentRound(state)?.size || 6 });
      return layout;
    },
    start() {
      startRun(state);
      recordedRunKey = null;
      interstitialRunKey = null;
      status = "找出每盘唯一不同的汉字。";
      drawCanvasFrame(context, state, { layout, status, profile });
      return createRunSummary(state);
    },
    update() {
      if (state.startedAt && !state.complete && getRemainingSeconds(state) <= 0) {
        if (pauseForRevive(state)) {
          status = "时间到了，可复活或记录本局。";
        } else {
          finishRun(state, "timeout");
          status = "本局结束。";
        }
      }
      if (state.complete) recordCompletion();
      drawCanvasFrame(context, state, { layout, status, profile });
      return createRunSummary(state);
    },
    async handleTouch(point) {
      const hit = hitTestCanvasLayout(layout, point);
      if (!hit) return { ok: false, reason: "empty" };

      if (hit.type === "cell") {
        const result = tapCell(state, hit.index);
        if (result.correct) {
          status = `正确 +${result.points}`;
        } else if (result.ok) {
          status = "点错了，连击重置。";
        }
        if (state.complete) recordCompletion();
        drawCanvasFrame(context, state, { layout, status, profile });
        return { ...result, hit };
      }

      const result = await handleAction(hit.action);
      drawCanvasFrame(context, state, { layout, status, profile });
      return result;
    },
    draw() {
      return drawCanvasFrame(context, state, { layout, status, profile });
    },
  };

  async function handleAction(action) {
    if (action === CANVAS_ACTIONS.START) {
      if (state.awaitingRevive) {
        finishRun(state, "timeout");
        recordCompletion();
        status = "本局已记录。";
        return { ok: true, action, recorded: true };
      }
      shell.start();
      return { ok: true, action };
    }

    if (action === CANVAS_ACTIONS.HINT) {
      if (!canUseReward(state, "hint")) return disabled(action);
      const reward = await platform.showRewarded("hint");
      if (!reward.ok) return rewardFailed(action, reward);
      const hint = grantHint(state);
      status = hint ? `提示：目标在${translateQuadrant(hint.quadrant)}。` : "当前没有可提示的轮次。";
      return { ok: Boolean(hint), action, reward };
    }

    if (action === CANVAS_ACTIONS.EXTRA_TIME) {
      if (!canUseReward(state, "extraTime")) return disabled(action);
      const reward = await platform.showRewarded("extra-time");
      if (!reward.ok) return rewardFailed(action, reward);
      const remaining = grantExtraTime(state, 10);
      status = "已增加 10 秒。";
      return { ok: true, action, remaining, reward };
    }

    if (action === CANVAS_ACTIONS.REVIVE) {
      if (!canOfferRevive(state)) return disabled(action);
      const reward = await platform.showRewarded("revive");
      if (!reward.ok) return rewardFailed(action, reward);
      const remaining = grantRevive(state, 15);
      status = "已复活 15 秒。";
      return { ok: true, action, remaining, reward };
    }

    if (action === CANVAS_ACTIONS.SHARE) {
      const text = createShareText(state);
      const shared = platform.share(text);
      status = shared ? "已打开分享。" : "成绩已生成，可复制分享。";
      return { ok: true, action, text, shared };
    }

    return { ok: false, action, reason: "unknown-action" };
  }

  function disabled(action) {
    status = "当前不能使用这个操作。";
    return { ok: false, action, reason: "disabled" };
  }

  function rewardFailed(action, reward) {
    status = "激励没有完成。";
    return { ok: false, action, reward };
  }

  function recordCompletion() {
    const summary = createRunSummary(state);
    const key = `${state.startedAt || "preview"}:${summary.dayKey}:${summary.finishedReason}`;
    if (state.startedAt && recordedRunKey !== key) {
      profile = recordRun(profile, summary);
      saveProfile(profile, { storage: platform.storage });
      recordedRunKey = key;
    }
    const endKey = `${state.startedAt || "preview"}:${state.run.dayKey}`;
    if (state.startedAt && interstitialRunKey !== endKey && profile.plays > 1) {
      interstitialRunKey = endKey;
      platform.showInterstitial();
    }
    return summary;
  }

  return shell;
}

export function drawCanvasFrame(ctx, state, { layout = createCanvasLayout(), status = "", profile = createEmptyProfile() } = {}) {
  if (!ctx) return false;
  const round = getCurrentRound(state);
  clear(ctx, layout.width, layout.height);
  drawBackground(ctx, layout);
  drawHeader(ctx, state, layout, status);
  drawGrid(ctx, state, round, layout);
  drawButtons(ctx, state, layout);
  drawFooter(ctx, state, profile, layout);
  return true;
}

function clear(ctx, width, height) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
}

function drawBackground(ctx, layout) {
  roundedRect(ctx, layout.header.x, layout.header.y, layout.header.width, layout.header.height, 14, COLORS.panel);
  roundedRect(ctx, layout.footer.x, layout.footer.y, layout.footer.width, layout.footer.height, 14, COLORS.panel);
}

function drawHeader(ctx, state, layout, status) {
  const summary = createRunSummary(state);
  const x = layout.header.x + 16;
  const y = layout.header.y + 26;
  drawText(ctx, "Hanzi Scout", x, y, { size: 24, weight: "700", color: COLORS.ink });
  drawText(ctx, `时间 ${getRemainingSeconds(state)}s  分数 ${summary.score}  连击 x${state.combo}`, x, y + 34, { size: 16, color: COLORS.ink });
  drawText(ctx, `进度 ${summary.solved}/${summary.total}  错点 ${summary.misses}/${summary.maxMisses}`, x, y + 60, { size: 14, color: COLORS.muted });
  drawText(ctx, status || "每日找字挑战。", x, y + 88, { size: 14, color: state.complete ? COLORS.accent : COLORS.warn });
}

function drawGrid(ctx, state, round, layout) {
  const grid = layout.grid;
  roundedRect(ctx, grid.x - 6, grid.y - 6, grid.size + 12, grid.size + 12, 18, COLORS.panel);
  if (!round || state.complete) {
    const summary = createRunSummary(state);
    drawText(ctx, summary.cleared ? "完成" : "记录", grid.x + grid.size / 2, grid.y + grid.size / 2 - 12, { size: 38, weight: "700", align: "center", color: COLORS.accent });
    drawText(ctx, `${summary.score} 分`, grid.x + grid.size / 2, grid.y + grid.size / 2 + 28, { size: 18, align: "center", color: COLORS.ink });
    return;
  }

  for (let index = 0; index < round.cells.length; index += 1) {
    const row = Math.floor(index / round.size);
    const col = index % round.size;
    const x = grid.x + col * grid.cellSize;
    const y = grid.y + row * grid.cellSize;
    const hinted = state.hint && hintMatches(index, round, state.hint.quadrant);
    ctx.fillStyle = hinted ? COLORS.accentSoft : "#ffffff";
    ctx.fillRect(x, y, grid.cellSize, grid.cellSize);
    ctx.strokeStyle = COLORS.line;
    ctx.strokeRect(x, y, grid.cellSize, grid.cellSize);
    drawText(ctx, round.cells[index].glyph, x + grid.cellSize / 2, y + grid.cellSize * 0.64, {
      size: Math.max(24, grid.cellSize * 0.48),
      align: "center",
      color: round.cells[index].target ? COLORS.target : COLORS.decoy,
      weight: "600",
    });
  }
}

function drawButtons(ctx, state, layout) {
  const disabled = new Set();
  if (!state.startedAt || state.complete || state.awaitingRevive || !canUseReward(state, "hint")) disabled.add(CANVAS_ACTIONS.HINT);
  if (!state.startedAt || state.complete || state.awaitingRevive || !canUseReward(state, "extraTime")) disabled.add(CANVAS_ACTIONS.EXTRA_TIME);
  if (!canOfferRevive(state)) disabled.add(CANVAS_ACTIONS.REVIVE);

  for (const button of layout.buttons) {
    const isDisabled = disabled.has(button.action);
    const label = button.action === CANVAS_ACTIONS.START
      ? state.awaitingRevive
        ? "结束并记录"
        : state.startedAt && !state.complete
          ? "重新开始"
          : "开始挑战"
      : button.label;
    const fill = isDisabled ? COLORS.disabled : button.primary ? COLORS.accent : COLORS.panel;
    const color = isDisabled ? COLORS.muted : button.primary ? "#ffffff" : COLORS.ink;
    roundedRect(ctx, button.x, button.y, button.width, button.height, 10, fill, COLORS.line);
    drawText(ctx, label, button.x + button.width / 2, button.y + 28, { size: 16, align: "center", color, weight: "600" });
  }
}

function drawFooter(ctx, state, profile, layout) {
  const summary = createRunSummary(state);
  const scoreCard = createScoreCard(profile, summary);
  const leaderboard = createFriendLeaderboard(profile, summary);
  const x = layout.footer.x + 14;
  let y = layout.footer.y + 24;
  drawText(ctx, scoreCard.record, x, y, { size: 13, color: COLORS.muted });
  y += 24;
  for (const item of createProgress(state)) {
    const radius = 8;
    ctx.fillStyle = item.solved ? COLORS.accent : item.current ? COLORS.warn : COLORS.line;
    ctx.beginPath();
    ctx.arc(x + (Number(item.label) - 1) * 22 + radius, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  y += 28;
  for (const entry of leaderboard.slice(0, 3)) {
    drawText(ctx, `${entry.rank}. ${entry.name} ${entry.score}`, x, y, { size: 13, color: entry.isPlayer ? COLORS.accent : COLORS.muted });
    y += 18;
  }
}

function drawText(ctx, text, x, y, { size = 14, color = COLORS.ink, weight = "400", align = "left" } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(text), x, y);
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (ctx.beginPath && ctx.quadraticCurveTo) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
}

function translateQuadrant(value) {
  return {
    "upper left": "左上区域",
    "upper right": "右上区域",
    "lower left": "左下区域",
    "lower right": "右下区域",
  }[value] || value;
}

function hintMatches(index, round, quadrant) {
  const row = Math.floor(index / round.size);
  const col = index % round.size;
  const targetUpper = quadrant.includes("upper");
  const targetLeft = quadrant.includes("left");
  return (targetUpper ? row < round.size / 2 : row >= round.size / 2) && (targetLeft ? col < round.size / 2 : col >= round.size / 2);
}
