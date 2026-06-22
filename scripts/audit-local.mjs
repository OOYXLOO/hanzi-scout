import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const required = [
  "README.md",
  "index.html",
  "docs/media/mobile-start.png",
  "docs/media/mobile-complete.png",
  "src/levels.js",
  "src/game.js",
  "src/profile.js",
  "src/wechat-adapter.js",
  "src/main.js",
  "src/styles.css",
  "tests/logic.test.mjs",
  "docs/wechat-port-plan.md",
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
