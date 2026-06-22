import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCanvasGameShell, createCanvasLayout, hitTestCanvasLayout, CANVAS_ACTIONS } from "../src/canvas-shell.js";
import { createGameState, getCurrentRound } from "../src/game.js";

let time = Date.parse("2026-06-22T00:00:00.000Z");
const state = createGameState({
  dayKey: "2026-06-22",
  now: () => time,
});
const context = createFakeCanvasContext();
const platform = createFakePlatform();
const shell = createCanvasGameShell({
  context,
  platform,
  state,
  width: 390,
  height: 844,
});

assert.equal(shell.draw(), true);
assert.ok(context.calls.some((call) => call[0] === "fillText" && call[1] === "Hanzi Scout"));

const layout = createCanvasLayout({ width: 390, height: 844, roundSize: 6 });
assert.equal(hitTestCanvasLayout(layout, { x: layout.grid.x + 1, y: layout.grid.y + 1 }).type, "cell");
assert.equal(hitTestCanvasLayout(layout, { x: layout.buttons[0].x + 4, y: layout.buttons[0].y + 4 }).action, CANVAS_ACTIONS.START);
assert.equal(hitTestCanvasLayout(layout, { x: -1, y: -1 }), null);

await shell.handleTouch(centerOf(layout.buttons[0]));
assert.equal(state.startedAt, time);
assert.match(shell.status, /找出/);

const first = getCurrentRound(state);
const targetPoint = centerOfCell(shell.layout, first.targetIndex);
const correct = await shell.handleTouch(targetPoint);
assert.equal(correct.correct, true);
assert.equal(state.solved.length, 1);

const hint = await shell.handleTouch(centerOf(shell.layout.buttons.find((button) => button.action === CANVAS_ACTIONS.HINT)));
assert.equal(hint.ok, true);
assert.equal(platform.rewardedReasons[0], "hint");

time = state.endsAt;
shell.update();
assert.equal(state.awaitingRevive, true);

const revive = await shell.handleTouch(centerOf(shell.layout.buttons.find((button) => button.action === CANVAS_ACTIONS.REVIVE)));
assert.equal(revive.ok, true);
assert.equal(state.awaitingRevive, false);

const share = await shell.handleTouch(centerOf(shell.layout.buttons.find((button) => button.action === CANVAS_ACTIONS.SHARE)));
assert.equal(share.ok, true);
assert.match(share.text, /Hanzi Scout 2026-06-22/);
assert.equal(platform.sharedText, share.text);

const canvasShellSource = await readFile(new URL("../src/canvas-shell.js", import.meta.url), "utf8");
assert.doesNotMatch(canvasShellSource, /document\.|querySelector|addEventListener|innerHTML|localStorage/);

console.log("hanzi scout canvas shell tests passed");

function centerOf(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function centerOfCell(layout, index) {
  const row = Math.floor(index / layout.grid.roundSize);
  const col = index % layout.grid.roundSize;
  return {
    x: layout.grid.x + col * layout.grid.cellSize + layout.grid.cellSize / 2,
    y: layout.grid.y + row * layout.grid.cellSize + layout.grid.cellSize / 2,
  };
}

function createFakePlatform() {
  return {
    storage: null,
    rewardedReasons: [],
    sharedText: "",
    async showRewarded(reason) {
      this.rewardedReasons.push(reason);
      return { ok: true, simulated: true, reason };
    },
    async showInterstitial() {
      return { ok: true, simulated: true };
    },
    share(text) {
      this.sharedText = text;
      return true;
    },
  };
}

function createFakeCanvasContext() {
  const calls = [];
  const context = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect(...args) {
      calls.push(["fillRect", ...args]);
    },
    strokeRect(...args) {
      calls.push(["strokeRect", ...args]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    quadraticCurveTo(...args) {
      calls.push(["quadraticCurveTo", ...args]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    fill() {
      calls.push(["fill"]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", ...args]);
    },
  };
  return context;
}
