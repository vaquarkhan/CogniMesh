#!/usr/bin/env node
"use strict";

/** Install portal deps (incl. vitest) without re-triggering root postinstall. */
if (process.env.COGNIMESH_SKIP_PORTAL_INSTALL === "1") {
  process.exit(0);
}

const { spawnSync } = require("child_process");
const path = require("path");

const portalDir = path.join(__dirname, "..", "portal");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const install = spawnSync(npm, ["install"], {
  cwd: portalDir,
  stdio: "inherit",
  env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
});

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

// Wire vitest: fail fast if portal test runner is missing after install
const vitest = spawnSync(npm, ["exec", "vitest", "--version"], {
  cwd: portalDir,
  stdio: "pipe",
  encoding: "utf8",
  env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
});

if (vitest.status !== 0) {
  console.warn("Portal vitest missing — retrying portal npm install once…");
  const retry = spawnSync(npm, ["install"], {
    cwd: portalDir,
    stdio: "inherit",
    env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
  });
  if (retry.status !== 0) {
    process.exit(retry.status ?? 1);
  }
  const vitest2 = spawnSync(npm, ["exec", "vitest", "--version"], {
    cwd: portalDir,
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
  });
  if (vitest2.status !== 0) {
    console.error("Portal vitest is not available after npm install.");
    process.exit(1);
  }
  const version2 = (vitest2.stdout || "").trim();
  if (version2) console.log(`Portal vitest ${version2} ready`);
} else {
  const version = (vitest.stdout || "").trim();
  if (version) {
    console.log(`Portal vitest ${version} ready`);
  }
}

// Optional: run portal unit tests during CI npm ci (skipped locally unless forced)
const runTests =
  process.env.CI === "true" || process.env.COGNIMESH_PORTAL_TEST === "1";
if (runTests && process.env.COGNIMESH_SKIP_PORTAL_TEST !== "1") {
  const tests = spawnSync(npm, ["test"], {
    cwd: portalDir,
    stdio: "inherit",
    env: { ...process.env, COGNIMESH_SKIP_PORTAL_INSTALL: "1" },
  });
  process.exit(tests.status === 0 ? 0 : tests.status ?? 1);
}

process.exit(0);
