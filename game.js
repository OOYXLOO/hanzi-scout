import { createCanvasGameShell } from "./src/canvas-shell.js";
import { createGameState } from "./src/game.js";
import { getDayKey } from "./src/levels.js";
import { createPlatformAdapter } from "./src/wechat-adapter.js";

export function createWeChatMiniGameApp({
  wxApi = globalThis.wx,
  canvas = wxApi?.createCanvas?.() || globalThis.canvas,
  platform = createPlatformAdapter({ wxApi }),
  frameMs = 1000 / 30,
  state,
} = {}) {
  if (!canvas) {
    throw new Error("A WeChat canvas is required.");
  }

  const context = canvas.getContext("2d");
  const metrics = readScreenMetrics(wxApi, canvas);
  const launchDayKey = normalizeLaunchDayKey(readLaunchOptions(wxApi)?.query?.day);
  prepareCanvas(canvas, context, metrics);

  const shell = createCanvasGameShell({
    canvas,
    context,
    platform,
    state: state || createGameState({ dayKey: launchDayKey || getDayKey() }),
    width: metrics.width,
    height: metrics.height,
  });

  let running = false;
  let frameHandle = null;

  function start() {
    if (running) return shell;
    running = true;
    shell.draw();
    tick();
    return shell;
  }

  function stop() {
    running = false;
    cancelFrame(wxApi, frameHandle);
    frameHandle = null;
  }

  function tick() {
    if (!running) return;
    shell.update();
    frameHandle = requestFrame(wxApi, tick, frameMs);
  }

  function handleTouchEvent(event) {
    const point = firstTouchPoint(event);
    if (!point) return null;
    return shell.handleTouch(point);
  }

  const unbindTouch = bindTouchStart(wxApi, handleTouchEvent);
  start();

  return {
    shell,
    canvas,
    context,
    start,
    stop,
    handleTouchEvent,
    destroy() {
      stop();
      unbindTouch();
    },
  };
}

export function normalizeLaunchDayKey(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function readLaunchOptions(wxApi) {
  try {
    return wxApi?.getLaunchOptionsSync?.() || {};
  } catch {
    return {};
  }
}

function readScreenMetrics(wxApi, canvas) {
  const info = wxApi?.getSystemInfoSync?.() || {};
  const width = Number(info.windowWidth || info.screenWidth || canvas.width || 390);
  const height = Number(info.windowHeight || info.screenHeight || canvas.height || 844);
  const pixelRatio = Number(info.pixelRatio || 1);
  return {
    width: Math.max(320, Math.floor(width)),
    height: Math.max(568, Math.floor(height)),
    pixelRatio: Math.max(1, pixelRatio),
  };
}

function prepareCanvas(canvas, context, { width, height, pixelRatio }) {
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  if (context?.scale && pixelRatio !== 1) {
    context.scale(pixelRatio, pixelRatio);
  }
}

function firstTouchPoint(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  if (!touch) return null;
  return {
    x: Number(touch.clientX ?? touch.x),
    y: Number(touch.clientY ?? touch.y),
  };
}

function bindTouchStart(wxApi, handler) {
  if (!wxApi?.onTouchStart) return () => {};
  wxApi.onTouchStart(handler);
  return () => {
    wxApi.offTouchStart?.(handler);
  };
}

function requestFrame(wxApi, callback, frameMs) {
  if (wxApi?.requestAnimationFrame) return wxApi.requestAnimationFrame(callback);
  if (globalThis.requestAnimationFrame) return globalThis.requestAnimationFrame(callback);
  return globalThis.setTimeout(callback, frameMs);
}

function cancelFrame(wxApi, handle) {
  if (handle === null || handle === undefined) return;
  if (wxApi?.cancelAnimationFrame) {
    wxApi.cancelAnimationFrame(handle);
    return;
  }
  if (globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  globalThis.clearTimeout(handle);
}

if (globalThis.wx && !globalThis.__HANZI_SCOUT_NO_AUTOSTART__) {
  createWeChatMiniGameApp();
}
