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
  await page.locator(".sidebar-tabs button", { hasText: label }).click();
  await sleep(450);
}

async function runDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(1000);
  await dismissWelcome(page);

  // 1. Pattern library
  await clickTab(page, "Architectures");
  await page.locator(".pattern-arch-filters button", { hasText: "Data Mesh" }).click();
  await sleep(500);
  const card = page.locator(".pattern-card-header").first();
  if ((await card.count()) > 0) await card.click();
  await sleep(700);

  // 2. Load mesh pattern onto canvas
  const meshBtn = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
  if ((await meshBtn.count()) > 0) await meshBtn.click();
  await sleep(1400);

  // 3. Select a block → properties
  const node = page.locator(".react-flow__node").nth(2);
  if ((await node.count()) > 0) {
    await node.click({ force: true });
    await sleep(900);
  }

  // 4. AI Builder plan
  await clickTab(page, "AI Builder");
  const pipelineInput = page.locator(".ai-builder-input").first();
  await pipelineInput.fill("Customer 360 data mesh with parallel domains and Iceberg gold");
  await sleep(400);
  await page.locator(".ai-builder-submit").first().click();
  await sleep(900);

  // 5. Load generated plan
  const loadBtn = page.locator('.design-plan-actions button:has-text("Load pipeline")');
  if ((await loadBtn.count()) > 0) {
    await loadBtn.click();
    await sleep(1200);
  } else {
    await clickTab(page, "Architectures");
    await page.locator(".pattern-arch-filters button", { hasText: "Data Mesh" }).click();
    await sleep(300);
    const use = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
    if ((await use.count()) > 0) await use.click();
    await sleep(1200);
  }

  // 6. AWS Design Review
  const reviewBtn = page.locator(".header-actions button").filter({ hasText: "AWS Review" });
  if ((await reviewBtn.count()) > 0) {
    await reviewBtn.click();
    await sleep(1200);
  }

  // 7. Preview YAML
  const previewBtn = page.locator(".header-actions button").filter({ hasText: "Preview YAML" });
  if ((await previewBtn.count()) > 0) {
    await previewBtn.click();
    await sleep(1500);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }

  // 8. Marketplace
  const mktBtn = page.locator(".header-actions button").filter({ hasText: "Marketplace" });
  if ((await mktBtn.count()) > 0) {
    await mktBtn.first().click();
    await sleep(1200);
    await mktBtn.first().click();
    await sleep(400);
  }

  // 9. Operations panel
  const opsBtn = page.locator('button:has-text("Operations")');
  if ((await opsBtn.count()) > 0) {
    await opsBtn.click();
    await sleep(800);
    const liveTab = page.locator('.platform-ops-tabs button:has-text("Live ops")');
    if ((await liveTab.count()) > 0) await liveTab.click();
    await sleep(700);
    const healthTab = page.locator('.platform-ops-tabs button:has-text("Health")');
    if ((await healthTab.count()) > 0) await healthTab.click();
    await sleep(700);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }

  // 10. Agent Builder teaser
  await page.locator(".designer-mode-switch button", { hasText: "Agent Builder" }).click();
  await sleep(500);
  await clickTab(page, "Templates");
  const agentTpl = page.locator('button.pattern-use-btn:has-text("Use template")').first();
  if ((await agentTpl.count()) > 0) await agentTpl.click();
  await sleep(1200);

  await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
  await sleep(600);
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
  await sleep(500);

  spawnProc("node", ["services/api-gateway/server.js"], { api: true });
  spawnProc("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", PORTAL_PORT, "--strictPort"], {
    cwd: path.join(ROOT, "portal"),
    env: { API_PROXY_TARGET: API_URL },
  });

  let browser;
  try {
    await waitForUrl(`${API_URL}/health`);
    await waitForUrl(PORTAL_URL);

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
    await runDemoFlow(page);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
