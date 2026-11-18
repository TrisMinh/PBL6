/* global process, console */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(
  web,
  "../../../../outputs/admin-checklist-20261118",
);
fs.mkdirSync(output, { recursive: true });
const suites = [
  ["live", ["scripts/verify-admin-live.mjs"]],
  ["resilience", ["scripts/verify-admin-resilience.mjs"]],
  ["forms", ["scripts/verify-admin-forms.mjs"]],
  ["gaps", ["scripts/verify-admin-gaps.mjs"]],
  ["transaction-codes", ["scripts/verify-admin-transaction-codes.mjs"]],
  ["organization-code", ["scripts/verify-admin-organization-code.mjs"]],
  ["filter-search", ["scripts/verify-admin-filter-search.mjs"]],
  ["proxy", ["scripts/verify-admin-proxy.mjs"]],
  [
    "unit",
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "src/features/admin",
      "--maxWorkers=1",
    ],
  ],
  ["types", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  [
    "lint",
    [
      "node_modules/eslint/bin/eslint.js",
      "scripts/verify-admin-live.mjs",
      "scripts/verify-admin-resilience.mjs",
      "scripts/verify-admin-forms.mjs",
      "scripts/verify-admin-gaps.mjs",
      "scripts/verify-admin-organization-code.mjs",
      "scripts/verify-admin-transaction-codes.mjs",
      "scripts/verify-admin-filter-search.mjs",
      "scripts/admin-filter-select.mjs",
      "scripts/verify-admin-proxy.mjs",
      "scripts/run-admin-checklist.mjs",
      "src/features/admin",
      "--max-warnings=0",
    ],
  ],
];
const results = { startedAt: new Date().toISOString(), suites: [] };
for (const [name, args] of suites) {
  console.log(`START: ${name}`);
  let log = "";
  const started = Date.now();
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: web,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    child.stdout.on("data", (data) => {
      log += data;
      process.stdout.write(data);
    });
    child.stderr.on("data", (data) => {
      log += data;
      process.stderr.write(data);
    });
    child.on("error", (error) => {
      log += error.message;
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
  fs.writeFileSync(path.join(output, `${name}.txt`), log);
  const checks = log
    .split(/\r?\n/)
    .filter((line) => line.startsWith("PASS:"))
    .map((line) => line.slice(6));
  results.suites.push({
    name,
    exitCode,
    checks,
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  });
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`END: ${name} exit=${exitCode} checks=${checks.length}`);
}
results.finishedAt = new Date().toISOString();
fs.writeFileSync(
  path.join(output, "results.json"),
  JSON.stringify(results, null, 2),
);
if (results.suites.some((suite) => suite.exitCode !== 0)) process.exitCode = 1;
