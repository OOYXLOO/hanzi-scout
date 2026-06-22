import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createWeChatPackagePlan } from "./audit-wechat-package.mjs";

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
    "  npm run export:publisher-handoff -- --public-app-url https://... --source-repo-url https://...",
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

function formatStatusRows(files) {
  return files
    .map((file) => `| \`${file.path}\` | ${file.exists ? "ready" : "missing"} | ${file.bytes ?? "-"} |`)
    .join("\n");
}

function formatRequiredPackageFiles(files) {
  return files.map((file) => `- \`${file.path}\`: ${file.status} - ${file.purpose}`).join("\n");
}

function formatHandoff({ plan, publicAppUrl, sourceRepoUrl }) {
  return [
    "# Hanzi Scout Publisher Handoff",
    "",
    "This handoff keeps the browser preview, native mini game boundary, and owner-side publishing gates in one reviewable place.",
    "",
    "## Current Public Build",
    `- Browser preview: ${publicAppUrl || "<public app URL>"}`,
    `- Source repository: ${sourceRepoUrl || "<source repository URL>"}`,
    "- Native entry: `game.js` and `game.json`",
    "- Safe DevTools template: `project.config.example.json`",
    "",
    "## Release Evidence",
    "| File | Status | Bytes |",
    "| --- | --- | ---: |",
    formatStatusRows(plan.files),
    "",
    "## Package Boundary",
    "Reusable runtime modules:",
    ...plan.reusableModules.map((file) => `- \`${file}\``),
    "",
    "Browser-only surfaces that stay out of the native canvas runtime:",
    ...plan.browserOnlyModules.map((item) => `- \`${item.path}\`: ${item.reason}`),
    "",
    "Planned package files:",
    formatRequiredPackageFiles(plan.requiredPackageFiles),
    "",
    "## Owner-Side Batch Gates",
    ...plan.userGates.map((gate) => `- ${gate}`),
    "",
    "## Verification Commands",
    "```bash",
    "npm run check",
    "npm test",
    "npm run audit:local",
    "npm run audit:wechat",
    "```",
    "",
    "## Publisher Notes",
    "- Import with the safe template first, then replace owner-only project settings inside WeChat DevTools.",
    "- Keep real AppID values, ad unit ids, and platform console settings out of the public repository.",
    "- Validate rewarded assists on device before any public release candidate.",
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
  const text = formatHandoff({ plan, publicAppUrl, sourceRepoUrl });

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
