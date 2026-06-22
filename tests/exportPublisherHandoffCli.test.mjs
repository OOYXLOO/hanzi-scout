import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const script = new URL("../scripts/export-publisher-handoff.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const localFailure = await run(process.execPath, [
  script,
  "--public-app-url",
  "http://127.0.0.1:8788/",
  "--source-repo-url",
  "https://github.com/OOYXLOO/hanzi-scout",
]).then(
  () => null,
  (error) => error,
);
assert.ok(localFailure);
assert.match(`${localFailure.stderr}${localFailure.stdout}`, /must be public/);

const { stdout } = await run(process.execPath, [
  script,
  "--public-app-url",
  "https://ooyxloo.github.io/hanzi-scout/",
  "--source-repo-url",
  "https://github.com/OOYXLOO/hanzi-scout",
]);

assert.match(stdout, /# Hanzi Scout Publisher Handoff/);
assert.match(stdout, /Current Public Build/);
assert.match(stdout, /https:\/\/ooyxloo\.github\.io\/hanzi-scout\//);
assert.match(stdout, /https:\/\/github\.com\/OOYXLOO\/hanzi-scout/);
assert.match(stdout, /Release Evidence/);
assert.match(stdout, /Owner-Side Batch Gates/);
assert.match(stdout, /Verification Commands/);
assert.match(stdout, /npm run audit:wechat/);
assert.match(stdout, /project\.config\.example\.json/);

const help = await run(process.execPath, [script, "--help"]);
assert.match(help.stdout, /export:publisher-handoff/);

console.log("hanzi scout publisher handoff cli tests passed");
