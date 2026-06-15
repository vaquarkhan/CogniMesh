#!/usr/bin/env node
"use strict";

/** Install portal deps without re-triggering root postinstall (Windows-safe). */
if (process.env.COGNIMESH_SKIP_PORTAL_INSTALL === "1") {
  process.exit(0);
}

const { spawnSync } = require("child_process");
const path = require("path");

const portalDir = path.join(__dirname, "..", "portal");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(npm, ["install"], {
  cwd: portalDir,
  stdio: "inherit",
  env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
});

process.exit(result.status === 0 ? 0 : 1);
