#!/usr/bin/env node
"use strict";

/**
 * Capture portal UI screenshots for README (requires: npm run build --prefix portal, playwright).
 * Usage: npm run docs:screenshots
 */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "docs", "assets");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(url, ms = 90000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(600);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function spawnProc(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    cwd: ROOT,
    stdio: "ignore",
    shell: true,
    ...opts,
  });
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

async function main() {
  if (!fs.existsSync(path.join(ROOT, "portal", "dist", "index.html"))) {
    console.error("Run: npm run build --prefix portal");
    process.exit(1);
  }

  fs.mkdirSync(ASSETS, { recursive: true });

  const api = spawnProc("node", ["services/api-gateway/server.js"], {
    env: { ...process.env, AUTH_DISABLED: "true" },
  });
  const portal = spawnProc("npm", ["run", "preview", "--prefix", "portal", "--", "--host"], {});

  try {
    await waitForUrl("http://localhost:4000/health");
    await waitForUrl("http://localhost:4173");

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem("cognimesh_welcome_seen", "1");
    });
    await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
    await sleep(1200);
    await dismissWelcome(page);

    // ── 1. Pattern library with architecture filters ──
    await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
    await sleep(500);
    const firstCard = page.locator(".pattern-card-header").first();
    if ((await firstCard.count()) > 0) await firstCard.click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-pattern-library.png"),
    });

    // ── 2. Load Data Mesh multi-domain on canvas ──
    await page.locator(".pattern-arch-filters button", { hasText: "Data Mesh" }).click();
    await sleep(300);
    const meshBtn = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
    if ((await meshBtn.count()) > 0) await meshBtn.click();
    await sleep(1000);
    await page.locator(".canvas-column").screenshot({
      path: path.join(ASSETS, "portal-canvas-datamesh.png"),
    });

    // ── 3. AWS Blocks palette ──
    await page.locator(".sidebar-tabs button", { hasText: "AWS Blocks" }).click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-aws-blocks.png"),
    });

    // ── 4. AI Builder ──
    await page.locator(".sidebar-tabs button", { hasText: "AI Builder" }).click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-ai-builder.png"),
    });

    // ── 5. Full app with AWS design review HUD (Kappa pattern) ──
    await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
    await sleep(200);
    await page.locator(".pattern-arch-filters button", { hasText: "Kappa" }).click();
    await sleep(300);
    const kappaUse = page.locator("button.pattern-use-btn").first();
    if ((await kappaUse.count()) > 0) await kappaUse.click();
    await sleep(2500);
    await page.screenshot({ path: path.join(ASSETS, "portal-overview.png"), fullPage: false });

    await browser.close();
    console.log("Saved screenshots to docs/assets/");
  } finally {
    portal.kill("SIGTERM");
    api.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
