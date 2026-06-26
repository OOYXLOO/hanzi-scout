import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createWeChatPackagePlan, auditWeChatPackagePlan } from "./audit-wechat-package.mjs";

function parseArgs(argv) {
  const options = {
    publicAppUrl: "",
    sourceRepoUrl: "",
    output: "",
    allowLocal: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--allow-local") {
      options.allowLocal = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (!(key in options)) {
        throw new Error(`Unknown option: ${arg}`);
      }
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      options[key] = argv[index];
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function helpText() {
  return [
    "Usage:",
    "  npm run export:monetization-readiness -- --public-app-url https://... --source-repo-url https://...",
    "",
    "Options:",
    "  --public-app-url URL   Public browser preview URL.",
    "  --source-repo-url URL  Public source repository URL.",
    "  --output PATH          Optional file output. Defaults to stdout.",
    "  --allow-local          Permit localhost URLs for CLI tests only.",
  ].join("\n");
}

function assertHttpUrl(name, value, { required = false, allowLocal = false } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    if (required) throw new Error(`${name} is required`);
    return "";
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  if (!allowLocal && ["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error(`${name} must be public, not localhost`);
  }
  return parsed.toString();
}

function adTouchpoints() {
  return [
    {
      name: "hint assist",
      trigger: "Player requests one glyph-location clue while a round is active.",
      pacing: "Maximum two uses per run through `canUseReward(state, \"hint\")`.",
      evidence: "`grantHint` records the assist and `createRewardedVideoAd` gates the reward in WeChat mode.",
    },
    {
      name: "extra-time assist",
      trigger: "Player asks for more time before the run is complete.",
      pacing: "Maximum one use per run, adding a short time extension only after completion.",
      evidence: "`grantExtraTime` refuses inactive or already-complete runs and shares the rewarded-video boundary.",
    },
    {
      name: "timeout revive",
      trigger: "Timer expires before all six rounds are solved.",
      pacing: "Maximum one revive per run; it resumes play for 15 seconds after completion.",
      evidence: "`pauseForRevive`, `canOfferRevive`, and `grantRevive` keep revive state explicit and testable.",
    },
    {
      name: "completion interstitial",
      trigger: "Later completed-round surfaces may show a lightweight interstitial.",
      pacing: "Optional and skipped when no real interstitial unit exists.",
      evidence: "`showInterstitial` reports skipped WeChat state instead of blocking score recording.",
    },
  ];
}

function retentionLoops() {
  return [
    {
      loop: "daily deterministic challenge",
      evidence: "A fixed daily seed creates the same board for share comparison without server data.",
    },
    {
      loop: "daily target and streak memory",
      evidence: "Local profile state tracks best score, streak, play count, and recent history.",
    },
    {
      loop: "share payload",
      evidence: "`createSharePayload` carries `day`, `score`, `solved`, and `from` query fields.",
    },
    {
      loop: "simulated leaderboard pressure",
      evidence: "Seeded rival rows show repeat-play pressure without reading a real social graph.",
    },
  ];
}

function table(rows, columns) {
  const head = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => row[column.key]).join(" | ")} |`)
    .join("\n");
  return [head, divider, body].join("\n");
}

function formatReadinessPack({ plan, publicAppUrl, sourceRepoUrl }) {
  const audit = auditWeChatPackagePlan(plan);
  return [
    "# Hanzi Scout Monetization Readiness Pack",
    "",
    "This pack summarizes the ad touchpoints, replay loops, and owner-side evidence still needed before a WeChat mini game release candidate.",
    "",
    "## Public Review Targets",
    `- Browser preview: ${publicAppUrl || "<public app URL>"}`,
    `- Source repository: ${sourceRepoUrl || "<source repository URL>"}`,
    `- WeChat package preflight: ${audit.ok ? "ready" : "needs review"}`,
    "",
    "## Ad Touchpoint Matrix",
    table(adTouchpoints(), [
      { key: "name", label: "Touchpoint" },
      { key: "trigger", label: "Player trigger" },
      { key: "pacing", label: "Responsible reward pacing" },
      { key: "evidence", label: "Current evidence" },
    ]),
    "",
    "## Retention & Share Loop",
    table(retentionLoops(), [
      { key: "loop", label: "Loop" },
      { key: "evidence", label: "Evidence" },
    ]),
    "",
    "## Responsible Reward Pacing",
    "- Rewarded assists are optional and never required to record a completed run.",
    "- Browser preview uses simulated completion for testing; WeChat mode requires a completed rewarded-video close event.",
    "- Missing rewarded or interstitial ad units are reported as skipped boundaries, not treated as successful rewards.",
    "- Real AppID values and ad unit ids stay outside the public repository.",
    "",
    "## Owner-Side Evidence Checklist",
    ...plan.userGates.map((gate) => `- Confirm ${gate}.`),
    "- Capture one device run showing hint assist, extra-time assist, timeout revive, completion, and share payload.",
    "- Confirm ad unit ids stay outside the public repository and are injected only through owner-side configuration.",
    "- Re-run the verification commands after replacing the safe DevTools template with private project settings.",
    "",
    "## Verification Commands",
    "```bash",
    "npm run check",
    "npm test",
    "npm run audit:local",
    "npm run audit:wechat",
    "```",
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }

  const publicAppUrl = assertHttpUrl("public app URL", options.publicAppUrl, { allowLocal: options.allowLocal });
  const sourceRepoUrl = assertHttpUrl("source repository URL", options.sourceRepoUrl, { allowLocal: options.allowLocal });
  const plan = await createWeChatPackagePlan();
  const text = formatReadinessPack({ plan, publicAppUrl, sourceRepoUrl });

  if (options.output) {
    await writeFile(resolve(options.output), text, "utf8");
  } else {
    process.stdout.write(`${text}\n`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
