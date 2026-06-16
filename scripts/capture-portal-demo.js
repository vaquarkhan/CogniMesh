#!/usr/bin/env node
"use strict";

/**
 * Record an end-to-end portal UI walkthrough for README / docs.
 * Usage: npm run docs:demo
 * Output: docs/assets/cognimesh-portal-demo.webm (+ .mp4 / .gif when ffmpeg is available)
 */

const { chromium } = require("playwright");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "assets");
const DEMO_BASE = "cognimesh-portal-demo";
const VIEWPORT = { width: 1280, height: 720 };
const API_PORT = process.env.DEMO_API_PORT || "4020";
const PORTAL_PORT = process.env.DEMO_PORTAL_PORT || "4174";
const API_URL = `http://127.0.0.1:${API_PORT}`;
const PORTAL_URL = `http://127.0.0.1:${PORTAL_PORT}`;

const procs = [];

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
  const { cwd = ROOT, env: extraEnv = {}, api = false } = opts;
  const env = {
    ...process.env,
    AUTH_DISABLED: "true",
    CATALOG_STORAGE: "memory",
    CORS_ORIGINS: PORTAL_URL,
    ...extraEnv,
  };
  if (api) env.PORT = API_PORT;
  const child = spawn(cmd, args, { cwd, stdio: "ignore", shell: true, env });
  procs.push(child);
  return child;
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
    /* port free */
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

function hasFfmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function convertWithFfmpeg(webmPath) {
  const mp4Path = path.join(OUT_DIR, `${DEMO_BASE}.mp4`);
  const gifPath = path.join(OUT_DIR, `${DEMO_BASE}.gif`);
  const posterPath = path.join(OUT_DIR, `${DEMO_BASE}-poster.png`);

  execSync(
    `ffmpeg -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${mp4Path}"`,
    { stdio: "inherit" }
  );

  execSync(
    [
      `ffmpeg -y -i "${webmPath}"`,
      "-vf",
      '"fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer"',
      "-an",
      `"${gifPath}"`,
    ].join(" "),
    { stdio: "inherit", shell: true }
  );

  execSync(
    `ffmpeg -y -i "${webmPath}" -frames:v 1 -update 1 "${posterPath}"`,
    { stdio: "inherit" }
  );

  return { mp4Path, gifPath, posterPath };
}

async function dismissWelcome(page) {
  const btn = page.locator(
    'button:has-text("Browse all patterns"), button:has-text("Get started"), button:has-text("Skip")'
  );
  if ((await btn.count()) > 0) {
    await btn.first().click({ force: true });
    await sleep(500);
  }
}

async function clickTab(page, label) {
  await ensurePipelineMode(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 15000 });
  const btn = page.locator(".designer-sidebar .sidebar-tabs button").filter({ hasText: label });
  await btn.first().waitFor({ state: "attached", timeout: 10000 });
  await btn.first().click({ force: true });
  await sleep(450);
}

async function ensureDesignerSidebar(page) {
  await ensurePipelineMode(page);
  if ((await page.locator(".designer-sidebar").count()) === 0) {
    await page.locator('.designer-mode-switch button:has-text("Data Pipeline")').click({ force: true });
    await sleep(600);
  }
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 15000 });
}

async function ensurePipelineMode(page) {
  const pipeBtn = page.locator('.designer-mode-switch button:has-text("Data Pipeline")');
  if ((await pipeBtn.count()) === 0) return;
  const cls = (await pipeBtn.getAttribute("class")) || "";
  if (!cls.includes("active")) {
    await pipeBtn.click({ force: true });
    await sleep(600);
  }
}

async function fitCanvasView(page) {
  await collapseAwsHud(page);
  const fitBtn = page.locator('.react-flow__controls-fitview, button[aria-label="fit view"]');
  if ((await fitBtn.count()) > 0) {
    await fitBtn.click({ force: true });
    await sleep(450);
  }
}

async function clickCanvasNode(page, label) {
  await collapseAwsHud(page);
  const node = page.locator(".react-flow__node").filter({ hasText: label });
  await node.first().waitFor({ state: "attached", timeout: 12000 });
  await node.first().click({ force: true });
  await sleep(400);
}

async function loadMultiSourcePattern(page) {
  const loadBtn = page.locator('button:has-text("Load: Multi-Source workflow")');
  if ((await loadBtn.count()) === 0) {
    await clickTab(page, "Architectures");
    await page.locator(".pattern-arch-filters button", { hasText: "Workflow" }).click();
    await sleep(400);
    const use = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
    if ((await use.count()) > 0) await use.click();
  } else {
    await loadBtn.click();
  }
  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 12000 });
  await sleep(600);
  await fitCanvasView(page);
}

async function collapseAwsHud(page) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  if ((await hud.count()) === 0) return;
  const expanded = await hud.evaluate((el) => el.classList.contains("expanded")).catch(() => false);
  if (expanded) {
    await hud.locator(".aws-review-header").click();
    await sleep(450);
  }
}

async function waitForPortalApi() {
  const url = `${PORTAL_URL}/health`;
  const start = Date.now();
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.status === "ok" || data?.status === "degraded") return;
      }
    } catch {
      /* retry */
    }
    await sleep(600);
  }
  throw new Error(`Timeout waiting for portal API proxy at ${url}`);
}

async function waitForAwsReview(page) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  await hud.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="aws-review-hud"]');
      return el && !el.querySelector(".aws-review-loading");
    },
    { timeout: 20000 }
  );
  await sleep(500);
}

async function ensureAwsReviewReady(page) {
  await waitForAwsReview(page);
  const errBody = page.locator(".aws-review-error-body");
  if ((await errBody.count()) > 0) {
    const retry = page.locator('button:has-text("Retry review"), button.aws-refresh-btn:has-text("Re-scan")');
    if ((await retry.count()) > 0) {
      await retry.first().click({ force: true });
      await waitForAwsReview(page);
    }
  }
}

async function runDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(1000);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await loadMultiSourcePattern(page);
  await ensureAwsReviewReady(page);

  // 2. AWS Design Review HUD (auto-scan + Security tab)
  const hud = page.locator('[data-testid="aws-review-hud"]');
  const expanded = await hud.evaluate((el) => el.classList.contains("expanded")).catch(() => true);
  if (!expanded) await hud.locator(".aws-review-header").click();
  await sleep(700);
  const securityTab = hud.locator('.aws-review-tabs button:has-text("Security")');
  if ((await securityTab.count()) > 0) await securityTab.click();
  await sleep(800);

  // 3. HUD wizard — Fix first + focus block (shows Properties findings without canvas click)
  const fixFirstTab = hud.locator('.aws-review-tabs button:has-text("Fix first")');
  if ((await fixFirstTab.count()) > 0) {
    await fixFirstTab.click({ force: true });
    await sleep(600);
    const fixThis = hud.locator('.aws-review-wizard-nav button:has-text("Fix this")');
    if ((await fixThis.count()) > 0) await fixThis.click({ force: true });
    await sleep(1000);
  }
  const focusBlock = hud.locator('button:has-text("Focus block")').first();
  if ((await focusBlock.count()) > 0) {
    await focusBlock.click({ force: true });
    await sleep(800);
    await page.locator('[data-testid="props-aws-findings"]').waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await sleep(600);
  }
  await collapseAwsHud(page);

  // 4. AI Builder
  const pipelineInput = page.locator(".designer-sidebar .ai-builder-input").first();
  await pipelineInput.waitFor({ state: "visible", timeout: 15000 });
  await pipelineInput.fill("Customer 360 data mesh with parallel domains and Iceberg gold");
  await sleep(400);
  await page.locator(".designer-sidebar .ai-builder-submit").first().click();
  await sleep(900);
  const loadBtn = page.locator('.designer-sidebar .design-plan-actions button:has-text("Load pipeline")');
  if ((await loadBtn.count()) > 0) {
    await loadBtn.click();
    await sleep(1200);
  }

  // 6. Preview YAML
  await collapseAwsHud(page);
  const previewBtn = page.locator(".header-actions button").filter({ hasText: "Preview YAML" });
  if ((await previewBtn.count()) > 0) {
    await previewBtn.click();
    await sleep(1600);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }

  // 7. Marketplace
  const mktBtn = page.locator(".header-actions button").filter({ hasText: "Marketplace" });
  if ((await mktBtn.count()) > 0) {
    await mktBtn.first().click();
    await sleep(1100);
    await mktBtn.first().click();
    await sleep(400);
  }

  // 8. Operations
  const opsBtn = page.locator('button:has-text("Operations")');
  if ((await opsBtn.count()) > 0) {
    await opsBtn.click();
    await sleep(800);
    const liveTab = page.locator('.platform-ops-tabs button:has-text("Live ops")');
    if ((await liveTab.count()) > 0) await liveTab.click();
    await sleep(700);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }

  // 9. Agent Builder — Customer Support with guardrails
  await page.locator(".designer-mode-switch button", { hasText: "Agent Builder" }).click();
  await sleep(600);
  const agentCard = page.locator(".pattern-card").filter({ hasText: "Customer Support Agent" });
  if ((await agentCard.count()) > 0) {
    await agentCard.locator(".pattern-card-header").click();
    await sleep(500);
    await agentCard.locator('button:has-text("Use this agent template")').click();
    await sleep(1400);
    await page.locator(".agent-node-label").filter({ hasText: "PII Guardrail" }).first().click({ force: true });
    await sleep(800);
    await page.locator('button:has-text("Preview manifest")').click();
    await sleep(1200);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }

  await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
  await sleep(500);
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, "portal", "dist", "index.html"))) {
    console.error("Run: npm run build --prefix portal");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videoScratch = path.join(OUT_DIR, ".demo-video-tmp");
  fs.mkdirSync(videoScratch, { recursive: true });

  killPort(API_PORT);
  killPort(PORTAL_PORT);
  await sleep(1200);

  spawnProc("node", ["services/api-gateway/server.js"], { api: true });
  spawnProc("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", PORTAL_PORT, "--strictPort"], {
    cwd: path.join(ROOT, "portal"),
    env: { API_PROXY_TARGET: API_URL },
  });

  let browser;
  try {
    await waitForUrl(`${API_URL}/health`);
    await waitForUrl(PORTAL_URL);
    await waitForPortalApi();
    await sleep(800);

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: videoScratch, size: VIEWPORT },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.localStorage.setItem("cognimesh_welcome_seen", "1");
    });

    console.log("Recording portal demo…");
    try {
      await runDemoFlow(page);
    } catch (flowErr) {
      await page.screenshot({ path: path.join(OUT_DIR, "demo-capture-failure.png"), fullPage: true }).catch(() => {});
      throw flowErr;
    }

    const video = page.video();
    await context.close();
    await browser.close();
    browser = null;

    const recorded = await video.path();
    const webmPath = path.join(OUT_DIR, `${DEMO_BASE}.webm`);
    fs.renameSync(recorded, webmPath);
    fs.rmSync(videoScratch, { recursive: true, force: true });

    console.log(`Saved ${webmPath}`);

    if (hasFfmpeg()) {
      console.log("Converting with ffmpeg…");
      const { mp4Path, gifPath } = convertWithFfmpeg(webmPath);
      console.log(`Saved ${mp4Path}`);
      console.log(`Saved ${gifPath}`);
    } else {
      console.log("ffmpeg not found — README will use .webm (install ffmpeg for .mp4 / .gif)");
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    killProcs();
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
