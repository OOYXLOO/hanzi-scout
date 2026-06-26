import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const script = new URL("../scripts/export-monetization-readiness.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

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

assert.match(stdout, /# Hanzi Scout Monetization Readiness Pack/);
assert.match(stdout, /Ad Touchpoint Matrix/);
assert.match(stdout, /hint assist/);
assert.match(stdout, /extra-time assist/);
assert.match(stdout, /timeout revive/);
assert.match(stdout, /Retention & Share Loop/);
assert.match(stdout, /share payload/);
assert.match(stdout, /Responsible Reward Pacing/);
assert.match(stdout, /Owner-Side Evidence Checklist/);
assert.match(stdout, /ad unit ids stay outside the public repository/);
assert.match(stdout, /Verification Commands/);
assert.match(stdout, /npm run audit:wechat/);
assert.match(stdout, /https:\/\/ooyxloo\.github\.io\/hanzi-scout\//);
assert.match(stdout, /https:\/\/github\.com\/OOYXLOO\/hanzi-scout/);

const help = await run(process.execPath, [script, "--help"]);
assert.match(help.stdout, /export:monetization-readiness/);

console.log("hanzi scout monetization readiness cli tests passed");
