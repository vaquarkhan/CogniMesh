#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

try {
  execSync("npm run docs:tutorials", { cwd: root, stdio: "pipe" });
  const diff = execSync("git diff --name-only docs/tutorials", { cwd: root, encoding: "utf8" }).trim();
  if (diff) {
    console.error("Stale tutorial docs detected. Run: npm run docs:tutorials");
    console.error(diff);
    process.exit(1);
  }
  console.log("Tutorial docs are up to date.");
} catch (err) {
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
}
