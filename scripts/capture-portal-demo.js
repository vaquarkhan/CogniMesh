#!/usr/bin/env node
"use strict";

/**
 * Record portal UI walkthroughs for README / docs.
 * Usage: npm run docs:demo
 * Output:
 *   docs/assets/cognimesh-pipeline-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-agent-demo.{webm,mp4,gif}
 */

const { chromium } = require("playwright");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "assets");
const VIEWPORT = { width: 1280, height: 720 };
const API_PORT = process.env.DEMO_API_PORT || "4020";
const PORTAL_PORT = process.env.DEMO_PORTAL_PORT || "4174";
const API_URL = `http://127.0.0.1:${API_PORT}`;
const PORTAL_URL = `http://127.0.0.1:${PORTAL_PORT}`;

const PIPELINE_ARCH_FILTERS = [
  "All",
  "Data Mesh",
  "Data Lake",
  "Lakehouse",
  "Kappa",
  "Lambda (λ)",
  "Streaming",
  "Medallion",
  "Step Functions",
];

const PIPELINE_CATEGORIES = ["All", "Data Mesh", "Structured", "Streaming", "ETL / ELT", "Cognitive"];

const AGENT_CATEGORIES = [
  "All",
  "Customer Experience",
  "Enterprise",
  "Data & Analytics",
  "Security",
  "CogniMesh",
];

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

function convertWithFfmpeg(webmPath, demoBase) {
  const mp4Path = path.join(OUT_DIR, `${demoBase}.mp4`);
  const gifPath = path.join(OUT_DIR, `${demoBase}.gif`);
  const posterPath = path.join(OUT_DIR, `${demoBase}-poster.png`);

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

async function ensurePipelineMode(page) {
  const pipeBtn = page.locator('.designer-mode-switch button:has-text("Data Pipeline")');
  if ((await pipeBtn.count()) === 0) return;
  const cls = (await pipeBtn.getAttribute("class")) || "";
  if (!cls.includes("active")) {
    await pipeBtn.click({ force: true });
    await sleep(600);
  }
}

async function ensureAgentMode(page) {
  const agentBtn = page.locator('.designer-mode-switch button:has-text("Agent Builder")');
  if ((await agentBtn.count()) === 0) return;
  const cls = (await agentBtn.getAttribute("class")) || "";
  if (!cls.includes("active")) {
    await agentBtn.click({ force: true });
    await sleep(600);
  }
}

async function clickTab(page, label) {
  await ensurePipelineMode(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 15000 });
  const btn = page.locator(".designer-sidebar .sidebar-tabs button").filter({ hasText: label });
  await btn.first().click({ force: true });
  await sleep(450);
}

async function collapseAwsHud(page) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  if ((await hud.count()) === 0) return;
  const expanded = await hud.evaluate((el) => el.classList.contains("expanded")).catch(() => false);
  if (expanded) {
    await hud.locator(".aws-review-header").click({ force: true });
    await sleep(450);
  }
}

async function expandAwsHud(page) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  if ((await hud.count()) === 0) return hud;
  const expanded = await hud.evaluate((el) => el.classList.contains("expanded")).catch(() => false);
  if (!expanded) {
    await hud.locator(".aws-review-header").click({ force: true });
    await sleep(500);
  }
  return hud;
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

async function browsePatternLibrary(page) {
  await clickTab(page, "AWS Blocks");
  await page.locator(".palette-item").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await sleep(700);
  await clickTab(page, "Architectures");

  for (const label of PIPELINE_ARCH_FILTERS) {
    const btn = page.locator(".pattern-arch-filters button").filter({ hasText: label });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(380);
    }
  }

  for (const c of PIPELINE_CATEGORIES) {
    const btn = page.locator(".pattern-filters button").filter({ hasText: c });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(350);
    }
  }

  const headers = page.locator(".designer-sidebar .pattern-card-header");
  const count = Math.min(await headers.count(), 4);
  for (let i = 0; i < count; i++) {
    await headers.nth(i).click({ force: true });
    await sleep(450);
  }
}

async function loadMultiSourcePattern(page) {
  await clickTab(page, "Architectures");
  await page.locator(".pattern-arch-filters button", { hasText: "Step Functions" }).click({ force: true });
  await sleep(400);

  const pattern = page.locator(".pattern-card").filter({ hasText: "Multi-Source" });
  if ((await pattern.count()) > 0) {
    await pattern.first().locator(".pattern-card-header").click({ force: true });
    await sleep(500);
    await pattern.first().locator('button:has-text("Use this pattern")').click({ force: true });
  } else {
    const loadBtn = page.locator('button:has-text("Load: Multi-Source workflow")');
    if ((await loadBtn.count()) > 0) await loadBtn.click({ force: true });
  }

  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 12000 });
  await sleep(800);
}

async function applyAllAwsFixes(page) {
  const hud = await expandAwsHud(page);

  for (const tab of ["Security", "Architecture", "Fix first"]) {
    const btn = hud.locator(".aws-review-tabs button").filter({ hasText: tab });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(500);
    }
  }

  for (let round = 0; round < 18; round++) {
    const focusBlock = hud.locator('button:has-text("Focus block")').first();
    if ((await focusBlock.count()) > 0) {
      await focusBlock.click({ force: true });
      await sleep(450);
    }

    while ((await page.locator('[data-testid^="props-aws-apply-"]:not([disabled])').count()) > 0) {
      await page.locator('[data-testid^="props-aws-apply-"]').first().click({ force: true });
      await sleep(1100);
      await ensureAwsReviewReady(page);
      if ((await focusBlock.count()) > 0) await focusBlock.click({ force: true }).catch(() => {});
      await sleep(300);
    }

    const fixThis = hud.locator('.aws-review-wizard-nav button:has-text("Fix this")');
    if ((await fixThis.count()) > 0) {
      await fixThis.click({ force: true });
      await sleep(700);
    }

    const criticalHeader = page.locator(".header-actions .header-score.score-bad");
    const criticalBanner = hud.locator(".aws-critical-banner");
    if ((await criticalHeader.count()) === 0 && (await criticalBanner.count()) === 0) break;

    const nextBtn = hud.locator('.aws-review-wizard-nav button:has-text("Next")');
    if ((await nextBtn.count()) === 0) break;
    await nextBtn.click({ force: true });
    await sleep(400);
  }

  await hud.locator('button.aws-refresh-btn:has-text("Re-scan")').click({ force: true }).catch(() => {});
  await ensureAwsReviewReady(page);
  await sleep(600);
}

async function previewAndDeployPipeline(page) {
  await collapseAwsHud(page);

  const previewBtn = page.locator('.header-actions button:has-text("Preview YAML")');
  await previewBtn.click({ force: true });
  await page.locator(".deploy-panel").waitFor({ state: "visible", timeout: 20000 });
  await sleep(1200);

  const deployBtn = page.locator('button.deploy-btn:has-text("Deploy Pipeline")').first();
  await deployBtn.click({ force: true });
  await sleep(800);

  const modal = page.locator('.modal-dialog:has-text("Deploy pipeline")');
  await modal.waitFor({ state: "visible", timeout: 10000 });
  await sleep(700);

  const yesDeploy = modal.locator('button.deploy-btn:has-text("Yes, deploy")');
  if (await yesDeploy.isEnabled()) {
    await yesDeploy.click({ force: true });
    await sleep(2500);
  } else {
    await modal.locator('button.btn-secondary:has-text("Cancel")').click({ force: true });
    await sleep(400);
  }
}

async function runPipelineDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  // 1. Browse pattern library (architectures + blocks)
  await browsePatternLibrary(page);

  // 2. Load Multi-Source workflow pattern
  await loadMultiSourcePattern(page);
  await ensureAwsReviewReady(page);

  // 3. Review — Security / Architecture / Fix-first
  const hud = await expandAwsHud(page);
  for (const tab of ["Security", "Architecture", "All"]) {
    const btn = hud.locator(".aws-review-tabs button").filter({ hasText: tab });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(650);
    }
  }

  // 4. Fix all critical / high findings
  await applyAllAwsFixes(page);
  await expandAwsHud(page);
  await sleep(800);

  // 5. Preview YAML → Deploy pipeline
  await previewAndDeployPipeline(page);
  await sleep(500);
}

async function clickAgentNode(page, label) {
  const nodeLabel = page.locator(".agent-node-label").filter({
    hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  });
  await nodeLabel.first().click({ force: true });
  await sleep(450);
}

async function browseAgentLibrary(page) {
  await ensureAgentMode(page);
  await page.waitForSelector(".agent-sidebar", { state: "visible", timeout: 15000 });

  const guideTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Guide')");
  await guideTab.click({ force: true });
  await sleep(600);

  const blocksTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Blocks')");
  await blocksTab.click({ force: true });
  await sleep(600);
  await page.locator(".agent-palette-item").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await sleep(500);

  const templatesTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Templates')");
  await templatesTab.click({ force: true });
  await sleep(400);

  for (const c of AGENT_CATEGORIES) {
    const btn = page.locator(".agent-template-library .pattern-filters button").filter({ hasText: c });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(350);
    }
  }

  for (const name of [
    "Customer Support Agent",
    "Fraud Investigation Agent",
    "RAG Document Q&A",
    "Data Analyst Agent",
  ]) {
    const card = page.locator(".agent-sidebar .pattern-card").filter({ hasText: name });
    if ((await card.count()) > 0) {
      await card.locator(".pattern-card-header").click({ force: true });
      await sleep(450);
    }
  }
}

async function loadCustomerSupportAgent(page) {
  await ensureAgentMode(page);
  const templatesTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Templates')");
  await templatesTab.click({ force: true });
  await sleep(400);

  await page.locator('.agent-template-library .pattern-filters button:has-text("All")').click({ force: true });
  await sleep(400);

  const observabilityCb = page.locator('[data-testid="agent-feature-observability"]');
  if ((await observabilityCb.count()) > 0 && (await observabilityCb.isChecked())) {
    await observabilityCb.uncheck({ force: true });
    await sleep(300);
  }

  const card = page.locator(".agent-sidebar .pattern-card").filter({ hasText: "Customer Support Agent" });
  await card.first().waitFor({ state: "visible", timeout: 12000 });
  await card.locator(".pattern-card-header").click({ force: true });
  await sleep(450);
  await card.locator('button:has-text("Use this agent template")').click({ force: true });
  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 12000 });
  await sleep(800);
}

async function reviewAndFixAgent(page) {
  for (const label of ["PII Guardrail", "Content Guardrail", "Support KB", "Support Runtime", "Claude Sonnet"]) {
    await clickAgentNode(page, label);
    await page.locator("aside.properties.agent-properties").waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await sleep(550);
  }

  const blocksTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Blocks')");
  await blocksTab.click({ force: true });
  await sleep(500);
  const templatesTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Templates')");
  await templatesTab.click({ force: true });
  await sleep(400);
}

async function deployAgent(page) {
  await page.locator('button:has-text("Preview manifest")').click({ force: true });
  await page.locator(".agent-preview-panel, .deploy-panel").first().waitFor({ state: "visible", timeout: 12000 });
  await sleep(1100);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  await page.locator('button:has-text("Export manifest")').click({ force: true });
  await sleep(900);

  await page.locator('button:has-text("Deploy to AWS")').click({ force: true });
  await page.locator(".agent-deploy-banner").waitFor({ state: "visible", timeout: 15000 });
  await sleep(1200);
}

async function runAgentDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await ensureAgentMode(page);

  // 1. Browse templates, blocks, categories
  await browseAgentLibrary(page);

  // 2. Load Customer Support template
  await loadCustomerSupportAgent(page);

  // 3. Review guardrails / blocks in Properties
  await reviewAndFixAgent(page);

  // 4. Preview → Export → Deploy
  await deployAgent(page);
  await sleep(500);
}

async function recordDemo(browser, demoBase, flowFn) {
  const videoScratch = path.join(OUT_DIR, `.demo-video-tmp-${demoBase}`);
  fs.mkdirSync(videoScratch, { recursive: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoScratch, size: VIEWPORT },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("cognimesh_welcome_seen", "1");
  });

  console.log(`Recording ${demoBase}…`);
  try {
    await flowFn(page);
  } catch (flowErr) {
    await page.screenshot({ path: path.join(OUT_DIR, `${demoBase}-capture-failure.png`), fullPage: true }).catch(() => {});
    throw flowErr;
  }

  const video = page.video();
  await context.close();

  const recorded = await video.path();
  const webmPath = path.join(OUT_DIR, `${demoBase}.webm`);
  fs.renameSync(recorded, webmPath);
  fs.rmSync(videoScratch, { recursive: true, force: true });

  console.log(`Saved ${webmPath}`);

  if (hasFfmpeg()) {
    console.log(`Converting ${demoBase} with ffmpeg…`);
    const { mp4Path, gifPath } = convertWithFfmpeg(webmPath, demoBase);
    console.log(`Saved ${mp4Path}`);
    console.log(`Saved ${gifPath}`);
  }

  return webmPath;
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, "portal", "dist", "index.html"))) {
    console.error("Run: npm run build --prefix portal");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

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

    await recordDemo(browser, "cognimesh-pipeline-demo", runPipelineDemoFlow);
    await recordDemo(browser, "cognimesh-agent-demo", runAgentDemoFlow);

    await browser.close();
    browser = null;
  } finally {
    if (browser) await browser.close().catch(() => {});
    killProcs();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
