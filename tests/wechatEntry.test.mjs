import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWeChatMiniGameApp } from "../game.js";
import { getCurrentRound } from "../src/game.js";

const wxApi = createFakeWxApi();
const platform = createFakePlatform();
const app = createWeChatMiniGameApp({
  wxApi,
  platform,
  frameMs: 1000,
});

assert.equal(wxApi.canvas.width, 780);
assert.equal(wxApi.canvas.height, 1688);
assert.equal(wxApi.context.scaleCalls.length, 1);
assert.equal(wxApi.touchHandlers.size, 1);
assert.equal(wxApi.requestedFrames.length, 1);

const startButton = app.shell.layout.buttons[0];
await app.handleTouchEvent({
  touches: [{ clientX: startButton.x + startButton.width / 2, clientY: startButton.y + startButton.height / 2 }],
});
assert.ok(app.shell.state.startedAt);

const round = getCurrentRound(app.shell.state);
const targetPoint = centerOfCell(app.shell.layout, round.targetIndex);
await wxApi.emitTouch(targetPoint.x, targetPoint.y);
assert.equal(app.shell.state.solved.length, 1);

app.destroy();
assert.equal(wxApi.touchHandlers.size, 0);

const entrySource = await readFile(new URL("../game.js", import.meta.url), "utf8");
const privateEntryPattern = new RegExp([
  ["App", "ID"].join(""),
  "adunit-",
  "project\\.config",
  ["sec", "ret"].join(""),
  ["pass", "word"].join(""),
  ["K", "YC"].join(""),
  ["pay", "out"].join(""),
].join("|"));
assert.doesNotMatch(entrySource, privateEntryPattern);
assert.match(entrySource, /createWeChatMiniGameApp/);

const gameJson = JSON.parse(await readFile(new URL("../game.json", import.meta.url), "utf8"));
assert.equal(gameJson.deviceOrientation, "portrait");
assert.equal(gameJson.showStatusBar, false);

console.log("hanzi scout wechat entry tests passed");

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
    async showRewarded(reason) {
      return { ok: true, simulated: true, reason };
    },
    async showInterstitial() {
      return { ok: true, simulated: true };
    },
    share() {
      return true;
    },
  };
}

function createFakeWxApi() {
  const context = createFakeContext();
  const touchHandlers = new Set();
  const requestedFrames = [];
  const wxApi = {
    canvas: {
      width: 390,
      height: 844,
      getContext() {
        return context;
      },
    },
    context,
    touchHandlers,
    requestedFrames,
    createCanvas() {
      return this.canvas;
    },
    getSystemInfoSync() {
      return {
        windowWidth: 390,
        windowHeight: 844,
        pixelRatio: 2,
      };
    },
    onTouchStart(handler) {
      touchHandlers.add(handler);
    },
    offTouchStart(handler) {
      touchHandlers.delete(handler);
    },
    requestAnimationFrame(callback) {
      requestedFrames.push(callback);
      return requestedFrames.length;
    },
    cancelAnimationFrame() {},
    async emitTouch(x, y) {
      const event = { touches: [{ clientX: x, clientY: y }] };
      await Promise.all([...touchHandlers].map((handler) => handler(event)));
    },
  };
  return wxApi;
}

function createFakeContext() {
  return {
    scaleCalls: [],
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    scale(...args) {
      this.scaleCalls.push(args);
    },
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    arc() {},
    fillText() {},
  };
}
