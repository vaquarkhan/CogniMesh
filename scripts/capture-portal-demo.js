#!/usr/bin/env node
"use strict";

/**
 * Record portal UI walkthroughs for README / docs.
 * Usage: npm run docs:demo
 *        DEMO_ONLY=howto npm run docs:demo   (captioned end-to-end tutorial)
 *        DEMO_ONLY=sdp-export,dbt-export,marketplace-proof npm run docs:demo
 * Output:
 *   docs/assets/cognimesh-howto-demo.{webm,mp4,gif}   caption → demo, each feature
 *   docs/assets/cognimesh-features-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-pipeline-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-agent-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-tutorial-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-sdp-export-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-dbt-export-demo.{webm,mp4,gif}
 *   docs/assets/cognimesh-marketplace-proof-demo.{webm,mp4,gif}
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

async function ensureCaptionUi(page) {
  await page.evaluate(() => {
    if (document.getElementById("cm-demo-caption-style")) return;
    const style = document.createElement("style");
    style.id = "cm-demo-caption-style";
    style.textContent = `
      #cm-demo-overlay { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; font-family: Inter, Segoe UI, system-ui, sans-serif; }
      #cm-demo-overlay[data-mode="title"] { pointer-events: auto; background: rgba(8,12,18,0.82); display: flex; align-items: center; justify-content: center; }
      #cm-demo-overlay[data-mode="bar"] { background: transparent; display: block; }
      #cm-demo-overlay[data-mode="hidden"] { display: none; }
      .cm-title-card { max-width: 820px; padding: 28px 36px; border: 1px solid #334155; background: #0f172a; color: #e7ecf3; }
      .cm-kicker { color: #34d399; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 10px; }
      .cm-title { font-size: 32px; line-height: 1.2; margin: 0 0 10px; font-weight: 650; }
      .cm-detail { color: #94a3b8; font-size: 16px; line-height: 1.45; margin: 0; }
      .cm-lower-third { position: absolute; left: 24px; right: 24px; bottom: 22px; display: none; align-items: center; gap: 14px;
        background: rgba(15,23,42,0.92); border: 1px solid #334155; padding: 10px 14px; }
      #cm-demo-overlay[data-mode="bar"] .cm-lower-third { display: flex; }
      #cm-demo-overlay[data-mode="title"] .cm-title-card { display: block; }
      #cm-demo-overlay[data-mode="bar"] .cm-title-card { display: none; }
      .cm-bar-kicker { color: #34d399; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
      .cm-bar-title { color: #e7ecf3; font-size: 15px; font-weight: 600; }
      .cm-bar-detail { color: #94a3b8; font-size: 13px; }
    `;
    document.head.appendChild(style);
    const overlay = document.createElement("div");
    overlay.id = "cm-demo-overlay";
    overlay.dataset.mode = "hidden";
    overlay.innerHTML = `
      <div class="cm-title-card">
        <p class="cm-kicker"></p>
        <h1 class="cm-title"></h1>
        <p class="cm-detail"></p>
      </div>
      <div class="cm-lower-third">
        <span class="cm-bar-kicker"></span>
        <span class="cm-bar-title"></span>
        <span class="cm-bar-detail"></span>
      </div>`;
    document.body.appendChild(overlay);
  });
}

async function showChapter(page, kicker, title, detail, holdMs = 2600) {
  await ensureCaptionUi(page);
  const payload = { kicker, title, detail };
  await page.evaluate(({ kicker, title, detail }) => {
    const overlay = document.getElementById("cm-demo-overlay");
    overlay.querySelector(".cm-kicker").textContent = kicker;
    overlay.querySelector(".cm-title").textContent = title;
    overlay.querySelector(".cm-detail").textContent = detail;
    overlay.querySelector(".cm-bar-kicker").textContent = kicker;
    overlay.querySelector(".cm-bar-title").textContent = title;
    overlay.querySelector(".cm-bar-detail").textContent = detail;
    overlay.dataset.mode = "title";
  }, payload);
  await sleep(holdMs);
  await page.evaluate(() => {
    const overlay = document.getElementById("cm-demo-overlay");
    overlay.dataset.mode = "bar";
  });
  await sleep(350);
}

async function showEndCard(page, title, detail, holdMs = 2800) {
  await showChapter(page, "End", title, detail, holdMs);
  await page.evaluate(() => {
    const overlay = document.getElementById("cm-demo-overlay");
    overlay.dataset.mode = "title";
  });
  await sleep(400);
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
      `ffmpeg -y -ss 1.2 -i "${webmPath}"`,
      "-vf",
      '"fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer"',
      "-an",
      `"${gifPath}"`,
    ].join(" "),
    { stdio: "inherit", shell: true }
  );

  execSync(
    `ffmpeg -y -ss 2 -i "${webmPath}" -frames:v 1 -update 1 "${posterPath}"`,
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
  await page
    .locator('.header-actions button:has-text("Preview YAML")')
    .waitFor({ state: "visible", timeout: 20000 })
    .catch(() => {});
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
  let hud = page.locator('[data-testid="aws-review-hud"]');
  if ((await hud.count()) === 0 || !(await hud.isVisible().catch(() => false))) {
    await page.locator('.header-actions button:has-text("AWS Review")').click({ force: true }).catch(() => {});
    await sleep(600);
  }
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

async function openDockFromPanelsMenu(page, label) {
  const tools = page.locator('[data-testid="header-tools-menu"], button.header-menu-trigger');
  await tools.first().click({ force: true });
  await sleep(250);
  const item = page
    .locator('[data-testid="header-tools-dropdown"] button[role="menuitemradio"], .header-menu-dropdown button[role="menuitemradio"]')
    .filter({ hasText: label });
  await item.first().click({ force: true });
  await sleep(550);
}

async function closeSidePanels(page) {
  const tools = page.locator('[data-testid="header-tools-menu"], button.header-menu-trigger');
  if ((await tools.count()) === 0) return;
  const anyPanel = page.locator(
    ".marketplace-panel, .platform-ops-panel, .execution-history-panel, .lineage-catalog-panel, .steward-panel, .steward-approvals-panel, .deploy-panel.dock"
  );
  if (!(await anyPanel.first().isVisible().catch(() => false))) return;
  await tools.first().click({ force: true });
  await sleep(200);
  const closeAll = page.locator(".header-menu-close-all");
  if ((await closeAll.count()) > 0) {
    await closeAll.first().click({ force: true });
    await sleep(350);
  } else {
    await tools.first().click({ force: true });
  }
}

async function clickHeaderButton(page, label) {
  const dockLabels = new Set(["Marketplace", "Operations", "Run History", "Lineage", "Approvals", "Deploy results"]);
  if (dockLabels.has(label)) {
    await openDockFromPanelsMenu(page, label);
    return;
  }
  const btn = page.locator(".header-actions button").filter({ hasText: label });
  await btn.first().click({ force: true });
  await sleep(550);
}

async function waitForLoadingDone(page, timeoutMs = 90000) {
  const overlay = page.locator(".loading-overlay");
  if ((await overlay.count()) > 0) {
    await overlay.waitFor({ state: "hidden", timeout: timeoutMs }).catch(() => {});
  }
  await page
    .locator('.deploy-panel h2:has-text("Deploying")')
    .waitFor({ state: "hidden", timeout: timeoutMs })
    .catch(() => {});
}

async function showAwsReviewTabs(page, tabs, pauseMs = 900) {
  const hud = await expandAwsHud(page);
  for (const tab of tabs) {
    const btn = hud.locator(".aws-review-tabs button").filter({ hasText: tab });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(pauseMs);
    }
  }
  return hud;
}

async function showMarketplaceWithProduct(page) {
  await closeSidePanels(page);
  await clickHeaderButton(page, "Marketplace");
  const panel = page.locator(".marketplace-panel");
  await panel.waitFor({ state: "visible", timeout: 15000 });
  const empty = panel.locator("text=No data products yet");
  const card = panel.locator(".product-card").first();
  await Promise.race([
    card.waitFor({ state: "visible", timeout: 25000 }),
    empty.waitFor({ state: "visible", timeout: 25000 }),
  ]).catch(() => {});

  if ((await card.count()) === 0) {
    await seedCatalogViaApi();
    await clickHeaderButton(page, "Marketplace");
    await clickHeaderButton(page, "Marketplace");
    await sleep(800);
  }

  if ((await card.count()) === 0) {
    throw new Error("Marketplace has no registered product after deploy");
  }

  await sleep(700);
  await card.locator(".product-card-main").click({ force: true });
  await sleep(1000);

  const accessBtn = panel.locator(".product-access-btn").first();
  if ((await accessBtn.count()) > 0) {
    await accessBtn.click({ force: true });
    await sleep(900);
  }
  await sleep(600);
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
  await loadPatternByName(page, {
    nameContains: "Multi-Source",
    archFilter: "Step Functions",
  });
}

async function loadPatternByName(page, { nameContains, archFilter, categoryFilter, search }) {
  await clickTab(page, "Architectures");
  // Reset filters so the pattern is findable
  const allArch = page.locator(".pattern-arch-filters button").filter({ hasText: /^All$/ });
  if ((await allArch.count()) > 0) {
    await allArch.first().click({ force: true });
    await sleep(250);
  }
  const allCat = page.locator(".pattern-filters button").filter({ hasText: /^All$/ });
  if ((await allCat.count()) > 0) {
    await allCat.first().click({ force: true });
    await sleep(250);
  }
  if (search) {
    const searchBox = page.locator(".pattern-search");
    if ((await searchBox.count()) > 0) {
      await searchBox.fill(search);
      await sleep(400);
    }
  }
  if (archFilter) {
    const archBtn = page.locator(".pattern-arch-filters button").filter({ hasText: archFilter });
    if ((await archBtn.count()) > 0) {
      await archBtn.first().click({ force: true });
      await sleep(400);
    }
  }
  if (categoryFilter) {
    const catBtn = page.locator(".pattern-filters button").filter({ hasText: categoryFilter });
    if ((await catBtn.count()) > 0) {
      await catBtn.first().click({ force: true });
      await sleep(400);
    }
  }

  const pattern = page.locator(".pattern-card").filter({ hasText: nameContains });
  if ((await pattern.count()) === 0) {
    throw new Error(`Pattern not found: ${nameContains}`);
  }
  await pattern.first().scrollIntoViewIfNeeded().catch(() => {});
  await pattern.first().locator(".pattern-card-header").click({ force: true });
  await sleep(500);
  const useBtn = pattern.first().locator('button:has-text("Use this pattern"), button:has-text("Use pattern")');
  await useBtn.first().click({ force: true });
  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 12000 });
  await sleep(800);
}

async function clickExportAndWait(page, testId, label) {
  await ensureAwsReviewReady(page);
  const hud = await expandAwsHud(page);
  const details = hud.locator("details.aws-topology-details");
  if ((await details.count()) > 0) {
    const open = await details.first().evaluate((el) => el.open).catch(() => true);
    if (!open) {
      await details.first().locator("summary").click({ force: true });
      await sleep(400);
    }
  }
  const btn = page.locator(`[data-testid="${testId}"]`);
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }).catch(() => null),
    btn.click({ force: true }),
  ]);
  if (download) {
    const dest = path.join(OUT_DIR, `.demo-download-${testId}.bin`);
    await download.saveAs(dest).catch(() => {});
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
  await sleep(1200);
  console.log(`Clicked export: ${label}`);
}

async function applyAllAwsFixes(page) {
  const hud = await expandAwsHud(page);

  for (const tab of ["Security", "Fix first"]) {
    const btn = hud.locator(".aws-review-tabs button").filter({ hasText: tab });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true });
      await sleep(450);
    }
  }

  for (let round = 0; round < 10; round++) {
    const focusBlock = hud.locator('button:has-text("Focus block")').first();
    if ((await focusBlock.count()) > 0) {
      await focusBlock.click({ force: true });
      await sleep(400);
    }

    const applyBtn = page.locator('[data-testid^="props-aws-apply-"]:not([disabled])').first();
    if ((await applyBtn.count()) > 0) {
      await applyBtn.click({ force: true });
      await sleep(1000);
      await ensureAwsReviewReady(page).catch(() => {});
      continue;
    }

    const fixThis = hud.locator('.aws-review-wizard-nav button:has-text("Fix this")');
    if ((await fixThis.count()) > 0) {
      await fixThis.click({ force: true });
      await sleep(500);
      continue;
    }

    const criticalHeader = page.locator(".header-actions .header-score.score-bad");
    if ((await criticalHeader.count()) === 0) break;

    const nextBtn = hud.locator('.aws-review-wizard-nav button:has-text("Next")');
    if ((await nextBtn.count()) === 0) break;
    await nextBtn.click({ force: true });
    await sleep(350);
  }

  await hud.locator('button.aws-refresh-btn:has-text("Re-scan")').click({ force: true }).catch(() => {});
  await sleep(800);
}

async function waitForDeploySuccess(page, timeoutMs = 120000) {
  await waitForLoadingDone(page, timeoutMs);
  const panel = page.locator(".deploy-panel");
  const successBadge = panel.locator(".badge-success");
  const registered = panel.locator('.deploy-summary >> text=Registered in marketplace');

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await successBadge.count()) > 0 && (await registered.count()) > 0) return;
    const errItems = panel.locator(".error-list li, .preview-error-banner li");
    if ((await errItems.count()) > 0 && (await successBadge.count()) === 0) {
      const msg = (await errItems.first().textContent()) || "unknown error";
      if (!/integrity gate|validation|graph/i.test(msg)) {
        throw new Error(`Deploy failed: ${msg.trim()}`);
      }
    }
    await sleep(400);
  }
  throw new Error("Deploy did not finish with marketplace registration");
}

function multiSourceMeshPayload() {
  const src = fs.readFileSync(path.join(ROOT, "portal", "src", "lib", "pipeline-patterns.js"), "utf8");
  const m = src.match(/id: "multi-source-mesh"[\s\S]*?nodes: (\[[\s\S]*?\]),\s*edges: (\[[\s\S]*?\]),/);
  if (!m) throw new Error("multi-source-mesh pattern missing from pipeline-patterns.js");
  // eslint-disable-next-line no-eval
  const nodes = eval(m[1]);
  // eslint-disable-next-line no-eval
  const edges = eval(m[2]);
  return {
    nodes,
    edges,
    pipelineMeta: {
      name: "multi-source-mesh",
      domain: "commerce",
      version: "1.0.0",
      ownerEmail: "local-dev@cognimesh.local",
    },
  };
}

async function seedCatalogViaApi() {
  const res = await fetch(`${API_URL}/api/v1/pipelines/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(multiSourceMeshPayload()),
  });
  const data = await res.json();
  if (data.status !== "success" || !data.catalog?.registered) {
    throw new Error(`Catalog seed deploy failed: ${data.stage || data.status}`);
  }
}

async function previewYaml(page) {
  await ensurePipelineMode(page);
  await waitForLoadingDone(page, 30000);
  await collapseAwsHud(page);
  await page.getByRole("button", { name: /Preview YAML/i }).click({ timeout: 25000 });
  await page.locator("aside.deploy-panel").waitFor({ state: "visible", timeout: 45000 });
  await sleep(900);
}

async function demoAiBuilder(page) {
  await clickTab(page, "AI Builder");
  const input = page.locator(".ai-builder-input");
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill("Multi-source pipeline: RDS and S3 in parallel, merge, integrity gate, Iceberg gold");
  await sleep(700);
  await page.locator("button.ai-builder-submit").click({ force: true });
  await page.locator(".design-plan-preview, .ai-builder").waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await sleep(1600);
}

async function clickIntegrityGate(page) {
  const gate = page.locator(".react-flow__node").filter({ hasText: /Integrity Gate|PVDM|VRP/i });
  if ((await gate.count()) > 0) {
    await gate.first().click({ force: true });
    await sleep(1100);
  }
}

async function runHowtoDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await showChapter(
    page,
    "CogniMesh tutorial",
    "How it works",
    "Each feature: caption first, then a live demo — pipeline, proof gate, deploy, then Agent Builder."
  );

  await showChapter(page, "1 · AI Builder", "Describe the pipeline in English", "Preview the plan before anything loads on the canvas.");
  await demoAiBuilder(page);

  await showChapter(page, "2 · Architectures", "Load a proven pattern", "Filter the library and drop Multi-Source onto the canvas.");
  await browsePatternLibrary(page);
  await loadMultiSourcePattern(page);

  await showChapter(page, "3 · Canvas + PVDM gate", "Sources → transform → integrity gate → sinks", "Gold publish is blocked unless VRP proof passes.");
  await clickIntegrityGate(page);

  await showChapter(page, "4 · AWS Design Review", "Security and architecture before deploy", "Scores, findings, and the inferred AWS map — including the proof bucket.");
  await ensureAwsReviewReady(page);
  await showAwsReviewTabs(page, ["Security", "Architecture", "All"], 900);

  await showChapter(page, "5 · Preview YAML", "DataContract and Step Functions ASL", "Review generated YAML before you commit to deploy.");
  await previewYaml(page);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  await showChapter(page, "6 · Deploy", "Integrity gate → PVDM proof → catalog", "Marketplace listing only after the proof-gated commit.");
  await completeDeployAndMarketplace(page);

  await showChapter(page, "7 · Operations", "Runs, lineage, marketplace", "Operate the published data product from the same portal.");
  for (const label of ["Operations", "Run History", "Lineage"]) {
    await clickHeaderButton(page, label);
    await sleep(900);
    await closeSidePanels(page);
    await sleep(250);
  }

  await showChapter(page, "8 · Agent Builder", "Templates, guardrails, preview, deploy", "Bedrock AgentCore agents from the same designer.");
  await ensureAgentMode(page);
  await browseAgentLibrary(page);
  await loadCustomerSupportAgent(page);
  await reviewAndFixAgent(page);
  await deployAgent(page);

  await showEndCard(page, "That's the end-to-end tour", "Written steps: docs/tutorials/getting-started-ui.md");
  await sleep(400);
}

async function runPipelineDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await showChapter(page, "Pipeline", "Create a pipeline end to end", "Load a pattern, review AWS, preview YAML, deploy, marketplace.");
  await loadMultiSourcePattern(page);
  await ensureAwsReviewReady(page);

  await showChapter(page, "AWS Design Review", "Fix findings before deploy", "Security, architecture, then the fix-first wizard.");
  await showAwsReviewTabs(page, ["Security", "Architecture", "All", "Fix first"], 1100);
  await expandAwsHud(page);
  await sleep(800);

  await showChapter(page, "Preview YAML", "Inspect the contract", "DataContract and Step Functions before deploy.");
  await previewYaml(page);

  await showChapter(page, "Fix and deploy", "Integrity gate then catalog", "Apply review fixes, deploy, register the product.");
  await applyAllAwsFixes(page);
  await collapseAwsHud(page);
  await sleep(600);

  await completeDeployAndMarketplace(page);
  await sleep(500);
}

async function completeDeployAndMarketplace(page) {
  await ensurePipelineMode(page).catch(() => {});
  await collapseAwsHud(page);

  const deployBtn = page.getByRole("button", { name: /Deploy Pipeline/i });
  if (await deployBtn.isVisible().catch(() => false)) {
    try {
      await deployBtn.click({ timeout: 8000 });
      const modal = page.locator('.modal-dialog:has-text("Deploy pipeline")');
      await modal.waitFor({ state: "visible", timeout: 12000 });
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('.modal-dialog button.deploy-btn:not(.btn-secondary)');
          return btn && !btn.disabled;
        },
        { timeout: 20000 }
      );
      const yesDeploy = modal.locator('button.deploy-btn:has-text("Yes, deploy")');
      const fixFirst = modal.locator('button.deploy-btn:has-text("Fix issues first")');
      if ((await fixFirst.count()) === 0 || !(await fixFirst.isVisible())) {
        if (await yesDeploy.isEnabled()) {
          await yesDeploy.click({ force: true });
          await waitForDeploySuccess(page).catch(() => {});
        }
      } else {
        await modal.locator('button.btn-secondary:has-text("Cancel")').click({ force: true });
      }
    } catch {
      /* UI deploy blocked after fix walkthrough — register via API for marketplace */
    }
  }

  await seedCatalogViaApi();
  await showMarketplaceWithProduct(page);
}

async function tourPipelineFeatures(page) {
  await ensurePipelineMode(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 15000 });

  for (const tab of ["AI Builder", "Architectures", "AWS Blocks", "Guide"]) {
    await clickTab(page, tab);
    await sleep(900);
  }

  await browsePatternLibrary(page);
  await loadMultiSourcePattern(page);
  await ensureAwsReviewReady(page);

  await clickHeaderButton(page, "AWS Review");
  await showAwsReviewTabs(page, ["Security", "Architecture", "All"], 750);

  for (const label of ["Operations", "Run History", "Lineage", "Marketplace"]) {
    await clickHeaderButton(page, label);
    const panel = page.locator(
      label === "Operations"
        ? ".platform-ops-panel"
        : label === "Run History"
          ? ".execution-history-panel, .deploy-panel:has-text('Run observability')"
          : label === "Lineage"
            ? ".lineage-catalog-panel"
            : ".marketplace-panel"
    );
    await panel.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await sleep(850);
    await clickHeaderButton(page, label);
    await sleep(300);
  }

  const previewBtn = page.locator('.header-actions button:has-text("Preview YAML")');
  await previewBtn.click({ force: true });
  await page.locator(".deploy-panel").waitFor({ state: "visible", timeout: 15000 });
  await sleep(900);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  await page.locator('.header-actions button.deploy-btn:has-text("Deploy Pipeline")').hover().catch(() => {});
  await sleep(500);
}

async function tourAgentFeatures(page) {
  await ensureAgentMode(page);
  await page.waitForSelector(".agent-sidebar", { state: "visible", timeout: 15000 });

  for (const tab of ["Guide", "Blocks", "Templates"]) {
    const btn = page.locator(".agent-sidebar .sidebar-tabs button").filter({ hasText: tab });
    await btn.first().click({ force: true });
    await sleep(850);
  }

  await browseAgentLibrary(page);

  for (const label of ["Preview manifest", "Export manifest", "Deploy to AWS"]) {
    const btn = page.locator(".agent-toolbar button").filter({ hasText: label });
    if ((await btn.count()) > 0) {
      await btn.first().hover().catch(() => {});
      await sleep(600);
    }
  }
}

async function runFeaturesDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);

  await showChapter(page, "Platform tour", "Designer, review, ops, agents", "Caption first, then each area of the portal.");
  await tourPipelineFeatures(page);
  await showChapter(page, "Agent Builder", "Same portal, Bedrock agents", "Templates, blocks, and deploy actions.");
  await tourAgentFeatures(page);
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
  await page.locator('[data-testid="agent-status-strip"], .agent-deploy-banner').first().waitFor({ state: "visible", timeout: 15000 });
  await sleep(1200);
}

async function runTutorialDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(700);
  await dismissWelcome(page);
  await ensurePipelineMode(page);

  await showChapter(page, "Getting started", "Panels, setup, Fix this, Preview", "First-time designer walkthrough.");

  await showChapter(page, "Panels", "Operations and the rest of the docks", "Operations, Approvals, Run History, Lineage, Marketplace.");
  await page.locator('[data-testid="header-tools-menu"]').click({ force: true });
  await page.locator('[data-testid="header-tools-dropdown"]').waitFor({ state: "visible", timeout: 8000 });
  await sleep(900);
  await page.locator('[data-testid="header-tools-dropdown"] button[role="menuitemradio"]').filter({ hasText: "Operations" }).click({ force: true });
  await page.locator(".platform-ops-panel").waitFor({ state: "visible", timeout: 10000 });
  await sleep(1000);
  await closeSidePanels(page);

  await showChapter(page, "Load a pattern", "Multi-Source on the canvas", "Properties show setup-ready when the checklist is complete.");
  await loadMultiSourcePattern(page);
  await ensureAwsReviewReady(page);
  await collapseAwsHud(page);
  const rds = page.locator(".react-flow__node").filter({ hasText: "RDS Orders" });
  await rds.first().click({ force: true });
  await page.locator('[data-testid="resource-setup-banner"]').waitFor({ state: "visible", timeout: 10000 });
  await sleep(1200);

  await showChapter(page, "AWS Fix this", "Existing database path", "Use existing DB, then open the review guide.");
  await page.locator('[data-testid="rds-resource-setup"] button:has-text("Use my existing database")').click({ force: true });
  await waitForAwsReview(page);
  await page.locator('[data-testid="props-aws-findings"]').waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  const fixBtn = page.locator('[data-testid^="props-aws-fix-setup.rds_secret"]');
  if ((await fixBtn.count()) > 0) {
    await fixBtn.first().click({ force: true });
    await sleep(1400);
  }

  await showChapter(page, "Preview YAML", "Contract before deploy", "Step Functions / DataContract preview.");
  await page.locator('.header-actions button:has-text("Preview YAML")').click({ force: true });
  await page.locator(".deploy-panel").waitFor({ state: "visible", timeout: 15000 });
  await sleep(1400);
}

async function runAgentDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await ensureAgentMode(page);

  await showChapter(page, "Agent Builder", "Create an agent end to end", "Templates, guardrails, preview, export, deploy.");
  await browseAgentLibrary(page);

  await showChapter(page, "Load template", "Customer Support Agent", "Guardrails, KB, and runtime pre-wired.");
  await loadCustomerSupportAgent(page);

  await showChapter(page, "Guardrails", "Review blocks on the canvas", "PII, content, KB, runtime, and model.");
  await reviewAndFixAgent(page);

  await showChapter(page, "Preview and deploy", "Manifest then AWS", "Preview, export YAML, deploy to AgentCore.");
  await deployAgent(page);
  await sleep(500);
}

async function runSdpExportDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await showChapter(
    page,
    "SDP export",
    "Spark Declarative Pipelines",
    "Author bronze/silver/gold as CREATE OR REFRESH views, then export a spark-pipelines project."
  );

  await showChapter(page, "1 · Pattern", "Load SDP Medallion", "Lakehouse pattern with spark_declarative transform and PVDM gate.");
  await loadPatternByName(page, {
    nameContains: "Spark Declarative Pipelines",
    search: "SDP",
    categoryFilter: "Lakehouse",
  });
  await clickIntegrityGate(page);

  await showChapter(page, "2 · Review", "AWS Design Review", "Security score and service topology before export.");
  await ensureAwsReviewReady(page);
  await showAwsReviewTabs(page, ["Architecture", "All"], 800);

  await showChapter(
    page,
    "3 · Export",
    "Download spark-pipeline.yml zip",
    "Run spark-pipelines locally. CogniMesh still requires VRP PASS before Iceberg publish."
  );
  await clickExportAndWait(page, "export-spark-declarative", "SDP");

  await showEndCard(page, "SDP export complete", "Tutorial: docs/tutorials/sdp-and-dbt.md");
  await sleep(400);
}

async function runDbtExportDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await showChapter(
    page,
    "dbt export",
    "dbt models + CogniMesh proof gate",
    "dbt owns SQL and schema tests; marketplace publish still needs VRP PASS."
  );

  await showChapter(page, "1 · Pattern", "Load dbt Silver → Gold", "Transform type dbt with model SQL and materialization.");
  await loadPatternByName(page, {
    nameContains: "dbt Silver",
    search: "dbt",
    categoryFilter: "ETL / ELT",
  });
  const dbtNode = page.locator(".react-flow__node").filter({ hasText: /dbt/i });
  if ((await dbtNode.count()) > 0) {
    await dbtNode.first().click({ force: true });
    await sleep(1000);
  }

  await showChapter(page, "2 · Review", "AWS Design Review", "Confirm topology, then export the dbt project zip.");
  await ensureAwsReviewReady(page);
  await showAwsReviewTabs(page, ["Architecture"], 700);

  await showChapter(page, "3 · Export", "Download dbt project", "dbt run && dbt test, then publish through CogniMesh Deploy.");
  await clickExportAndWait(page, "export-dbt-project", "dbt");

  await showEndCard(page, "dbt export complete", "A green dbt test is observational — not a keyed multiset proof.");
  await sleep(400);
}

async function runMarketplaceProofDemoFlow(page) {
  await page.goto(PORTAL_URL, { waitUntil: "networkidle" });
  await sleep(800);
  await dismissWelcome(page);
  await page.waitForSelector(".designer-sidebar", { state: "visible", timeout: 30000 });
  await ensurePipelineMode(page);

  await showChapter(
    page,
    "Marketplace proof",
    "Trust grade · verify · diff · SLA",
    "Consumers check VRP offline. Samples stay fail-closed without PASS."
  );

  await showChapter(page, "1 · Publish", "Register a data product", "Deploy path seeds the catalog so Marketplace has a product.");
  await seedCatalogViaApi();

  await showChapter(page, "2 · Discover", "Open Marketplace trust card", "Grade, profile, snapshot pin, and freshness SLA.");
  await showMarketplaceWithProduct(page);
  await sleep(1200);

  const passProof = JSON.parse(
    fs.readFileSync(path.join(ROOT, "fixtures", "vrp-conformance", "identity-pass.json"), "utf8")
  );
  const tampered = JSON.parse(
    fs.readFileSync(path.join(ROOT, "fixtures", "vrp-conformance", "identity-tampered.json"), "utf8")
  );

  await showChapter(page, "3 · Verify", "Paste VRP JSON", "No AWS credentials — offline structural verify.");
  const panel = page.locator(".marketplace-panel");
  const areas = panel.locator("textarea.proof-paste");
  await areas.first().waitFor({ state: "visible", timeout: 15000 });
  await areas.nth(0).fill(JSON.stringify(passProof, null, 2));
  await sleep(600);
  await panel.locator('button:has-text("Verify proof")').click({ force: true });
  await panel.locator(".vrp-pass-text, .vrp-fail-text").first().waitFor({ state: "visible", timeout: 15000 });
  await sleep(1400);

  await showChapter(page, "4 · Diff", "Compare two proofs", "Flag mutations on integrity fields between publications.");
  await areas.nth(1).fill(JSON.stringify(tampered, null, 2));
  await sleep(500);
  await panel.locator('button:has-text("Diff proofs")').click({ force: true });
  await sleep(1600);

  await showEndCard(page, "Proof-gated marketplace", "Tutorial: docs/tutorials/proof-gated-marketplace.md");
  await sleep(400);
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
  console.log("Building portal (empty VITE_API_URL so preview proxy works)…");
  execSync("npm run build --prefix portal", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, VITE_API_URL: "", API_PROXY_TARGET: "" },
  });

  if (!fs.existsSync(path.join(ROOT, "portal", "dist", "index.html"))) {
    console.error("Portal build failed");
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

    const only = (process.env.DEMO_ONLY || "").trim();
    const onlyParts = only ? only.split(/[,\s]+/).filter(Boolean) : [];
    const demos = [
      ["cognimesh-howto-demo", runHowtoDemoFlow],
      ["cognimesh-tutorial-demo", runTutorialDemoFlow],
      ["cognimesh-features-demo", runFeaturesDemoFlow],
      ["cognimesh-pipeline-demo", runPipelineDemoFlow],
      ["cognimesh-agent-demo", runAgentDemoFlow],
      ["cognimesh-sdp-export-demo", runSdpExportDemoFlow],
      ["cognimesh-dbt-export-demo", runDbtExportDemoFlow],
      ["cognimesh-marketplace-proof-demo", runMarketplaceProofDemoFlow],
    ];
    for (const [base, flow] of demos) {
      if (onlyParts.length && !onlyParts.some((p) => base.includes(p))) continue;
      await recordDemo(browser, base, flow);
    }

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
