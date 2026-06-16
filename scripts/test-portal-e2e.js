#!/usr/bin/env node
"use strict";

/**
 * Portal E2E — Operations panel and deploy-approval API flows.
 * Usage: npm run test:portal-e2e
 */

const { chromium } = require("playwright");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const API_PORT = process.env.E2E_API_PORT || "4010";
const PORTAL_PORT = process.env.E2E_PORTAL_PORT || "3010";
const API_URL = `http://127.0.0.1:${API_PORT}`;
const PORTAL_URL = `http://127.0.0.1:${PORTAL_PORT}`;

const procs = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(url, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function spawnProc(cmd, args, opts = {}) {
  const { cwd = ROOT, env = {} } = opts;
  const child = spawn(cmd, args, {
    cwd,
    stdio: "ignore",
    shell: true,
    env: {
      ...process.env,
      PORT: API_PORT,
      CORS_ORIGINS: PORTAL_URL,
      AUTH_DISABLED: "true",
      CATALOG_STORAGE: "memory",
      ...env,
    },
  });
  procs.push(child);
  return child;
}

async function dismissWelcome(page) {
  const btn = page.locator(
    'button:has-text("Browse all patterns"), button:has-text("Get started"), button:has-text("Skip")'
  );
  if ((await btn.count()) > 0) {
    await btn.first().click({ force: true });
    await sleep(400);
  }
}

async function testDeployApprovalApi() {
  const res = await fetch(`${API_URL}/api/v1/platform/deploy-approvals`);
  if (!res.ok) throw new Error(`deploy-approvals GET failed: ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.pending)) throw new Error("deploy-approvals missing pending array");
}

async function testOperationsPanel(page) {
  await page.goto(PORTAL_URL);
  await dismissWelcome(page);
  await sleep(1500);

  const opsBtn = page.locator('button:has-text("Operations")');
  if ((await opsBtn.count()) === 0) throw new Error("Operations button not found");
  await opsBtn.click();

  const panel = page.locator(".platform-ops-panel");
  await panel.waitFor({ state: "visible", timeout: 10000 });
  if ((await panel.count()) === 0) throw new Error("Operations panel did not open");

  const heading = panel.locator("h2", { hasText: "Operations" });
  if ((await heading.count()) === 0) throw new Error("Operations heading missing");

  const liveTab = panel.locator('.platform-ops-tabs button:has-text("Live ops")');
  await liveTab.click();

  const body = panel.locator(".platform-ops-body, .properties-hint, .deploy-errors");
  await body.first().waitFor({ state: "visible", timeout: 15000 });
  const err = panel.locator(".deploy-errors");
  if ((await err.count()) > 0) {
    throw new Error(`Operations panel error: ${await err.textContent()}`);
  }

  const versionsTab = panel.locator('.platform-ops-tabs button:has-text("Versions")');
  await versionsTab.click();
  await sleep(800);

  const healthTab = panel.locator('.platform-ops-tabs button:has-text("Health")');
  await healthTab.click();
  await sleep(800);
}

async function testStewardApprovalsPanel(page) {
  const approvalsBtn = page.locator('button:has-text("Approvals")');
  if ((await approvalsBtn.count()) === 0) throw new Error("Approvals button not found");
  await approvalsBtn.click();
  await sleep(500);

  const panel = page.locator(".steward-panel");
  if ((await panel.count()) === 0) throw new Error("Steward approvals panel did not open");

  const deploySection = panel.locator("h3", { hasText: "Pipeline deploys" });
  if ((await deploySection.count()) === 0) throw new Error("Pipeline deploys section missing");
}

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const m = line.trim().match(/LISTENING\s+(\d+)$/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
    }
  } catch {
    /* port already free */
  }
}
function killProcs() {
  for (const p of procs) {
    try {
      p.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  killPort(API_PORT);
  killPort(PORTAL_PORT);
  await sleep(500);

  console.log("Building portal…");
  execSync("npm run build --prefix portal", { cwd: ROOT, stdio: "inherit" });

  spawnProc("node", ["services/api-gateway/server.js"]);
  spawnProc("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", PORTAL_PORT, "--strictPort"], {
    cwd: path.join(ROOT, "portal"),
    env: { API_PROXY_TARGET: API_URL },
  });

  console.log(`Waiting for API ${API_URL}…`);
  await waitForUrl(`${API_URL}/health`);
  console.log(`Waiting for portal ${PORTAL_URL}…`);
  await waitForUrl(PORTAL_URL);

  await testDeployApprovalApi();
  console.log("✓ deploy-approvals API");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await testOperationsPanel(page);
    console.log("✓ Operations panel tabs");
    await testStewardApprovalsPanel(page);
    console.log("✓ Steward approvals panel");
  } finally {
    await browser.close();
  }

  console.log("\nPortal E2E passed.");
}

main()
  .catch((err) => {
    console.error("\nPortal E2E failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    killProcs();
  });
