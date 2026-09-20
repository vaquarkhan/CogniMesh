#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

try {
  execSync("npm run docs:tutorials", { cwd: root, stdio: "pipe" });
  const diff = execSync("git diff --name-only docs/tutorials", { cwd: root, encoding: "utf8" }).trim();
  if (diff) {
    console.error("Stale tutorial docs detected after regeneration.");
    console.error("Run: npm run docs:tutorials");
    console.error("Then commit the updated files under docs/tutorials/:");
    console.error(diff);
    process.exit(1);
  }
  console.log("Tutorial docs are up to date.");
} catch (err) {
  const detail = err.stderr?.toString?.() || err.stdout?.toString?.() || err.message;
  console.error("Tutorial docs check failed.");
  console.error(detail);
  console.error("\nHints:");
  console.error("- Ensure portal deps: npm install --prefix portal");
  console.error("- Re-run: npm run docs:tutorials");
  console.error("- Pattern sources: portal/src/lib/patterns/");
  process.exit(1);
}
