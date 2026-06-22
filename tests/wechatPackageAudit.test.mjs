import assert from "node:assert/strict";
import { auditWeChatPackagePlan, createWeChatPackagePlan } from "../scripts/audit-wechat-package.mjs";

const plan = await createWeChatPackagePlan();
const result = auditWeChatPackagePlan(plan);

assert.equal(result.ok, true);
assert.deepEqual(result.failures, []);
assert.ok(plan.reusableModules.includes("src/game.js"));
assert.ok(plan.reusableModules.includes("src/wechat-adapter.js"));
assert.ok(plan.reusableModules.includes("src/canvas-shell.js"));
assert.ok(plan.browserOnlyModules.some((item) => item.path === "src/main.js"));
assert.ok(plan.requiredPackageFiles.some((item) => item.path === "game.js" && item.status === "shell-ready"));
assert.ok(plan.requiredPackageFiles.some((item) => item.path === "project.config.json" && item.status === "user-gated"));
assert.match(plan.adapterConfig.rule, /Do not hard-code/);
assert.ok(plan.files.find((file) => file.path === "src/wechat-adapter.js").adBoundary);
assert.equal(plan.files.find((file) => file.path === "src/canvas-shell.js").browserOnly, false);
assert.ok(plan.files.find((file) => file.path === "src/main.js").browserOnly);

console.log("hanzi scout wechat package audit tests passed");
