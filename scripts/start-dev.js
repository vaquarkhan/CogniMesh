#!/usr/bin/env node
"use strict";

/**
 * Cross-platform dev starter - loads .env and runs API + portal (no Java/Maven).
 * Usage: npm run start:dev
 */
require("dotenv").config();

const { spawn } = require("child_process");
const path = require("path");

process.env.AUTH_DISABLED = process.env.AUTH_DISABLED || "true";
process.env.CATALOG_STORAGE = process.env.CATALOG_STORAGE || "memory";
process.env.CATALOG_FALLBACK = process.env.CATALOG_FALLBACK || "embedded";
process.env.COGNIMESH_SKIP_PORTAL_INSTALL = "1";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const root = path.join(__dirname, "..");

const portalDir = path.join(root, "portal");
const { spawnSync } = require("child_process");
console.log("Ensuring portal dependencies…");
const install = spawnSync(npm, ["install"], {
  cwd: portalDir,
  stdio: "inherit",
  env: process.env,
});
if (install.status !== 0) process.exit(install.status || 1);

console.log("\nStarting API (:4000) + Portal (:3000) - embedded catalog, auth disabled\n");

const child = spawn(
  npm,
  ["run", "dev:minimal"],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
