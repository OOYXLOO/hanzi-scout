import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const reusableModules = [
  "src/levels.js",
  "src/game.js",
  "src/profile.js",
  "src/wechat-adapter.js",
  "src/canvas-shell.js",
];

const browserOnlyModules = [
  {
    path: "src/main.js",
    reason: "DOM event binding and element rendering must become a Canvas/touch shell.",
  },
  {
    path: "src/styles.css",
    reason: "CSS layout does not run in the native mini game canvas runtime.",
  },
  {
    path: "index.html",
    reason: "The WeChat mini game entrypoint is game.js, not an HTML document.",
  },
];

const requiredPackageFiles = [
  {
    path: "game.js",
    status: "entry-ready",
    purpose: "Create the platform canvas, import the canvas shell, wire WeChat touch events, and start the frame loop.",
  },
  {
    path: "game.json",
    status: "entry-ready",
    purpose: "Declare orientation and mini game runtime settings.",
  },
  {
    path: "project.config.json",
    status: "user-gated",
    purpose: "Created in WeChat DevTools after the owner supplies AppID and project settings.",
  },
  {
    path: "project.config.example.json",
    status: "template-ready",
    purpose: "Safe import template using touristappid; copy locally before owner-side AppID configuration.",
  },
  {
    path: "ad-unit.config.js",
    status: "user-gated",
    purpose: "Inject real ad unit ids outside the public source tree.",
  },
];

const userGates = [
  "WeChat developer account",
  "Mini game AppID",
  "Traffic owner eligibility",
  "Rewarded and interstitial ad units",
  "Content category, privacy, review, entity, and owner-only account settings",
];

export async function createWeChatPackagePlan({ rootDir = root } = {}) {
  const files = [];
  for (const file of [
    ...reusableModules,
    ...browserOnlyModules.map((item) => item.path),
    "game.js",
    "game.json",
    "project.config.example.json",
    "README.md",
    "docs/wechat-port-plan.md",
    "docs/wechat-devtools-import.md",
  ]) {
    files.push(await inspectFile(rootDir, file));
  }
  const projectConfigExample = await readProjectConfigExample(rootDir);

  return {
    target: "wechat-mini-game-package-preflight",
    reusableModules,
    browserOnlyModules,
    requiredPackageFiles,
    userGates,
    adapterConfig: {
      source: "globalThis.__HANZI_SCOUT_CONFIG__.adUnits",
      rule: "Do not hard-code real ad unit ids, AppID, accounts, or owner-only platform settings in this repository.",
    },
    projectConfigExample,
    files,
  };
}

export function auditWeChatPackagePlan(plan) {
  const failures = [];
  for (const file of plan.files) {
    if (!file.exists) failures.push(`missing ${file.path}`);
  }

  const reusable = new Set(plan.reusableModules);
  for (const file of ["src/levels.js", "src/game.js", "src/profile.js", "src/wechat-adapter.js", "src/canvas-shell.js"]) {
    if (!reusable.has(file)) failures.push(`reusable module not listed: ${file}`);
  }

  const browserOnly = new Set(plan.browserOnlyModules.map((item) => item.path));
  for (const file of ["src/main.js", "src/styles.css", "index.html"]) {
    if (!browserOnly.has(file)) failures.push(`browser-only surface not listed: ${file}`);
  }

  const packageFiles = new Set(plan.requiredPackageFiles.map((item) => item.path));
  for (const file of ["game.js", "game.json", "project.config.json"]) {
    if (!packageFiles.has(file)) failures.push(`required package file not listed: ${file}`);
  }

  if (!plan.adapterConfig.rule.includes("Do not hard-code")) failures.push("adapter config rule is too weak");
  if (!plan.userGates.some((gate) => gate.includes("AppID"))) failures.push("AppID gate missing");
  if (!plan.userGates.some((gate) => gate.includes("owner-only"))) failures.push("owner-only account gate missing");
  const canvasShell = plan.files.find((file) => file.path === "src/canvas-shell.js");
  if (!canvasShell || canvasShell.browserOnly) failures.push("canvas shell must stay free of browser DOM bindings");
  const entry = plan.files.find((file) => file.path === "game.js");
  if (!entry || entry.browserOnly) failures.push("WeChat entry must stay free of browser DOM bindings");
  if (!plan.requiredPackageFiles.some((file) => file.path === "game.js" && file.status === "entry-ready")) {
    failures.push("game.js entry status should be entry-ready");
  }
  if (!plan.requiredPackageFiles.some((file) => file.path === "game.json" && file.status === "entry-ready")) {
    failures.push("game.json status should be entry-ready");
  }
  const projectConfigExample = plan.files.find((file) => file.path === "project.config.example.json");
  if (!projectConfigExample || !projectConfigExample.exists) failures.push("project config example missing");
  if (!plan.requiredPackageFiles.some((file) => file.path === "project.config.example.json" && file.status === "template-ready")) {
    failures.push("project config example should be template-ready");
  }
  if (plan.projectConfigExample?.appid !== "touristappid") failures.push("project config example must use touristappid");
  if (plan.projectConfigExample?.compileType !== "game") failures.push("project config example must use compileType game");
  if (plan.projectConfigExample?.containsPrivateConfig) failures.push("project config example includes private configuration markers");

  return {
    ok: failures.length === 0,
    failures,
  };
}

async function readProjectConfigExample(rootDir) {
  try {
    const text = await readFile(join(rootDir, "project.config.example.json"), "utf8");
    const config = JSON.parse(text);
    return {
      appid: config.appid,
      compileType: config.compileType,
      projectname: config.projectname,
      containsPrivateConfig: /adunit|secret|token|key|owner-only/i.test(text),
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

async function inspectFile(rootDir, path) {
  const absolute = join(rootDir, path);
  try {
    await access(absolute);
    const text = await readFile(absolute, "utf8");
    return {
      path,
      exists: true,
      bytes: Buffer.byteLength(text),
      browserOnly: /document\.|window\.|querySelector|addEventListener/.test(text),
      storageBoundary: text.includes("getStorageSync") || text.includes("localStorage"),
      adBoundary: text.includes("createRewardedVideoAd") || text.includes("createInterstitialAd"),
    };
  } catch {
    return {
      path: relative(rootDir, absolute),
      exists: false,
    };
  }
}

async function main() {
  const plan = await createWeChatPackagePlan();
  const result = auditWeChatPackagePlan(plan);
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log(JSON.stringify(plan, null, 2));
  console.log("PASS Hanzi Scout WeChat package preflight");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
