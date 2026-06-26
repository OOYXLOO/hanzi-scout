import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const required = [
  "README.md",
  "index.html",
  "game.js",
  "game.json",
  "docs/media/mobile-start.png",
  "docs/media/mobile-complete.png",
  "src/levels.js",
  "src/game.js",
  "src/profile.js",
  "src/wechat-adapter.js",
  "src/canvas-shell.js",
  "src/main.js",
  "src/styles.css",
  "tests/logic.test.mjs",
  "tests/canvasShell.test.mjs",
  "tests/wechatEntry.test.mjs",
  "tests/wechatPackageAudit.test.mjs",
  "tests/exportPublisherHandoffCli.test.mjs",
  "tests/exportMonetizationReadinessCli.test.mjs",
  "docs/wechat-port-plan.md",
  "docs/wechat-package-preflight.md",
  "docs/publisher-handoff.md",
  "docs/monetization-readiness.md",
  "scripts/audit-wechat-package.mjs",
  "scripts/export-publisher-handoff.mjs",
  "scripts/export-monetization-readiness.mjs",
];
const forbidden = [
  new RegExp(["money", "goal"].join("-"), "i"),
  new RegExp(["USD", "200"].join(" "), "i"),
  new RegExp("\\u8d5a\\u94b1"),
  new RegExp("\\u5956\\u91d1"),
  new RegExp(["cash", "prize"].join(" "), "i"),
];
const checkedExtensions = new Set([".md", ".html", ".js", ".mjs", ".css", ".json"]);

function extname(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

const failures = [];
for (const file of required) {
  try {
    const info = await stat(join(root, file));
    if (!info.isFile()) failures.push(`required file missing: ${file}`);
  } catch {
    failures.push(`required file missing: ${file}`);
  }
}

for (const image of ["docs/media/mobile-start.png", "docs/media/mobile-complete.png"]) {
  const bytes = await readFile(join(root, image));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (Buffer.compare(bytes.subarray(0, 8), signature) !== 0) {
    failures.push(`${image} is not a PNG`);
    continue;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 780 || height !== 1688) {
    failures.push(`${image} dimensions should be 780x1688, got ${width}x${height}`);
  }
}

const adapter = await readFile(join(root, "src/wechat-adapter.js"), "utf8");
if (!adapter.includes("createRewardedVideoAd")) failures.push("wechat adapter missing rewarded video hook");
if (!adapter.includes("createInterstitialAd")) failures.push("wechat adapter missing interstitial hook");
if (!adapter.includes("readiness")) failures.push("wechat adapter missing readiness boundary");
if (!adapter.includes("missing-rewarded-ad-unit")) failures.push("wechat adapter should refuse missing rewarded ad units in WeChat");
if (/adUnitId:\s*["']REPLACE_WITH_/.test(adapter)) failures.push("wechat adapter should not ship placeholder ad unit ids");

const html = await readFile(join(root, "index.html"), "utf8");
for (const id of ["quick-start-button", "hint-button", "time-button", "revive-button", "share-button", "glyph-grid", "goal-line", "profile-line", "result-card", "leaderboard-list"]) {
  if (!html.includes(id)) failures.push(`index.html missing ${id}`);
}

const profile = await readFile(join(root, "src/profile.js"), "utf8");
if (!profile.includes("createFriendLeaderboard")) failures.push("profile missing friend leaderboard generator");

const wechatAudit = await readFile(join(root, "scripts/audit-wechat-package.mjs"), "utf8");
if (!wechatAudit.includes("wechat-mini-game-package-preflight")) failures.push("wechat package audit missing target marker");
if (!wechatAudit.includes("project.config.json")) failures.push("wechat package audit missing project config gate");

const publisherHandoff = await readFile(join(root, "docs/publisher-handoff.md"), "utf8");
for (const marker of [
  "Hanzi Scout Publisher Handoff",
  "Current Public Build",
  "Owner-Side Batch Gates",
  "Verification Commands",
  "Release Evidence",
]) {
  if (!publisherHandoff.includes(marker)) failures.push(`publisher handoff missing ${marker}`);
}

const monetizationReadiness = await readFile(join(root, "docs/monetization-readiness.md"), "utf8");
for (const marker of [
  "Hanzi Scout Monetization Readiness Pack",
  "Ad Touchpoint Matrix",
  "Retention & Share Loop",
  "Responsible Reward Pacing",
  "Owner-Side Evidence Checklist",
]) {
  if (!monetizationReadiness.includes(marker)) failures.push(`monetization readiness missing ${marker}`);
}

const canvasShell = await readFile(join(root, "src/canvas-shell.js"), "utf8");
if (!canvasShell.includes("createCanvasGameShell")) failures.push("canvas shell missing runtime factory");
if (!canvasShell.includes("hitTestCanvasLayout")) failures.push("canvas shell missing touch hit test");
if (/document\.|querySelector|addEventListener|innerHTML|localStorage/.test(canvasShell)) {
  failures.push("canvas shell should not depend on browser DOM APIs");
}

const miniGameEntry = await readFile(join(root, "game.js"), "utf8");
if (!miniGameEntry.includes("createWeChatMiniGameApp")) failures.push("WeChat entry missing app factory");
if (!miniGameEntry.includes("onTouchStart")) failures.push("WeChat entry missing touch binding");
if (!miniGameEntry.includes("requestAnimationFrame")) failures.push("WeChat entry missing frame loop");
const privateEntryPattern = new RegExp([
  ["App", "ID"].join(""),
  "adunit-",
  "project\\.config",
  ["sec", "ret"].join(""),
  ["pass", "word"].join(""),
].join("|"));
if (privateEntryPattern.test(miniGameEntry)) {
  failures.push("WeChat entry should not contain account, ad unit, or owner-only console setup");
}

const miniGameConfig = JSON.parse(await readFile(join(root, "game.json"), "utf8"));
if (miniGameConfig.deviceOrientation !== "portrait") failures.push("game.json should declare portrait orientation");
if (miniGameConfig.showStatusBar !== false) failures.push("game.json should hide status bar for canvas play");

for (const file of await walk(root)) {
  if (!checkedExtensions.has(extname(file))) continue;
  const text = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      failures.push(`public wording hit ${pattern} in ${relative(root, file)}`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("PASS Hanzi Scout local audit");
