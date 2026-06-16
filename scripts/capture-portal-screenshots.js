#!/usr/bin/env node
"use strict";

/**
 * Capture portal UI screenshots for README and developer docs.
 * Usage: npm run docs:screenshots
 * Requires: npm run build --prefix portal, playwright
 */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "docs", "assets");
const IMAGES = path.join(ROOT, "docs", "images");
const DEV = path.join(IMAGES, "dev");

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

async function shot(page, locator, filePath) {
  const el = typeof locator === "string" ? page.locator(locator) : locator;
  if ((await el.count()) === 0) return false;
  await el.screenshot({ path: filePath });
  return true;
}

async function loadMeshPattern(page) {
  await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
  await sleep(300);
  await page.locator(".pattern-arch-filters button", { hasText: "Data Mesh" }).click();
  await sleep(300);
  const meshBtn = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
  if ((await meshBtn.count()) > 0) await meshBtn.click();
  await sleep(1200);
}

async function captureDeveloperDocs(page) {
  console.log("Capturing developer guide screenshots → docs/images/dev/");

  // ── Dev 01: Full pipeline app overview ──
  await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
  await sleep(300);
  await loadMeshPattern(page);
  await page.screenshot({ path: path.join(DEV, "01-pipeline-overview.png") });

  // ── Dev 02: Architectures + expanded pattern ──
  await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
  await sleep(300);
  const card = page.locator(".pattern-card-header").first();
  if ((await card.count()) > 0) await card.click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "02-pattern-library-expanded.png"));

  // ── Dev 03: AI pipeline designer ──
  await page.locator(".sidebar-tabs button", { hasText: "AI Builder" }).click();
  await sleep(300);
  await shot(page, ".designer-sidebar", path.join(DEV, "03-ai-pipeline-designer.png"));

  // ── Dev 04: AI pipeline plan preview ──
  const pipelineInput = page.locator(".ai-builder-input").first();
  await pipelineInput.fill("Multi-domain data mesh customer 360 with parallel domains");
  await sleep(300);
  await page.locator(".ai-builder-submit").first().click();
  await sleep(600);
  await shot(page, ".design-plan-preview", path.join(DEV, "04-pipeline-plan-preview.png"));
  if (!(await page.locator(".design-plan-preview").count())) {
    await shot(page, ".designer-sidebar", path.join(DEV, "04-pipeline-plan-preview.png"));
  }

  // ── Dev 05: Mesh canvas with swimlanes ──
  await page.locator('.design-plan-actions button:has-text("Load pipeline")').click().catch(() => {});
  await sleep(400);
  if ((await page.locator('.design-plan-actions button:has-text("Load pipeline")').count()) === 0) {
    await loadMeshPattern(page);
  }
  await shot(page, ".canvas-column", path.join(DEV, "05-canvas-datamesh-swimlanes.png"));

  // ── Dev 06: Block selected - properties panel ──
  await page.locator(".sidebar-tabs button", { hasText: "Guide" }).click();
  await sleep(300);
  const canvasNode = page.locator(".react-flow__node").first();
  if ((await canvasNode.count()) > 0) {
    await canvasNode.click({ force: true });
    await sleep(500);
  }
  await shot(page, ".properties", path.join(DEV, "06-block-properties-panel.png"));

  // ── Dev 07: Pipeline settings (no block selected) ──
  await page.locator(".react-flow__pane").first().click({ position: { x: 30, y: 30 }, force: true });
  await sleep(400);
  await shot(page, ".properties", path.join(DEV, "07-pipeline-settings-panel.png"));

  // ── Dev 08: AWS Blocks palette ──
  await page.locator(".sidebar-tabs button", { hasText: "AWS Blocks" }).click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "08-aws-blocks-palette.png"));

  // ── Dev 09: Guide tab ──
  await page.locator(".sidebar-tabs button", { hasText: "Guide" }).click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "09-workflow-guide.png"));

  // ── Dev 10: AWS Design Review HUD ──
  await loadMeshPattern(page);
  await sleep(2500);
  const reviewBtn = page.locator(".header-actions button").filter({ hasText: "AWS Review" });
  if ((await reviewBtn.count()) > 0) await reviewBtn.click();
  await sleep(500);
  await page.screenshot({ path: path.join(DEV, "10-aws-design-review.png") });

  // ── Dev 11: Preview YAML panel ──
  const previewBtn = page.locator(".header-actions button").filter({ hasText: "Preview YAML" });
  if ((await previewBtn.count()) > 0) {
    await previewBtn.click();
    await sleep(2000);
    await shot(page, ".deploy-panel", path.join(DEV, "11-preview-yaml-panel.png"));
    if (!(await page.locator(".deploy-panel").count())) {
      await page.screenshot({ path: path.join(DEV, "11-preview-yaml-panel.png") });
    }
  }

  // ── Dev 12: Marketplace panel ──
  const mktBtn = page.locator(".header-actions button").filter({ hasText: "Marketplace" });
  if ((await mktBtn.count()) > 0) {
    await mktBtn.first().click();
    await sleep(1500);
    await shot(page, ".marketplace-panel", path.join(DEV, "12-marketplace-panel.png"));
    if (!(await page.locator(".marketplace-panel").count())) {
      await shot(page, ".main", path.join(DEV, "12-marketplace-panel.png"));
    }
    await mktBtn.first().click();
    await sleep(300);
  }

  // ── Dev 13: Lambda canvas ──
  await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
  await sleep(200);
  await page.locator(".pattern-arch-filters button", { hasText: "Lambda" }).click();
  await sleep(300);
  const lambdaUse = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
  if ((await lambdaUse.count()) > 0) await lambdaUse.click();
  await sleep(1000);
  await shot(page, ".canvas-column", path.join(DEV, "13-lambda-architecture-canvas.png"));

  // ── Agent Builder captures ──
  await page.locator(".designer-mode-switch button", { hasText: "Agent Builder" }).click();
  await sleep(500);

  // ── Dev 14: Agent templates + features ──
  await page.locator(".sidebar-tabs button", { hasText: "Templates" }).click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "14-agent-templates-features.png"));

  // ── Dev 15: AI agent generator + features ──
  await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
  await sleep(300);
  await page.locator(".sidebar-tabs button", { hasText: "AI Builder" }).click();
  await sleep(300);
  await page.locator(".ai-builder-mode-tabs button", { hasText: "AI agent" }).click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "15-ai-agent-generator.png"));

  // ── Dev 16: Agent plan preview ──
  await page.locator(".ai-agent-builder .ai-builder-input").fill(
    "Customer support agent with FAQ knowledge base and PII guardrails"
  );
  await sleep(300);
  await page.locator(".ai-agent-builder .ai-builder-submit").click();
  await sleep(600);
  await shot(page, ".design-plan-preview", path.join(DEV, "16-agent-plan-preview.png"));

  // ── Dev 17: Agent canvas ──
  await page.locator('.design-plan-actions button:has-text("Open in Agent Builder")').click().catch(() => {});
  await sleep(800);
  if ((await page.locator(".agent-canvas .react-flow__node").count()) === 0) {
    await page.locator(".designer-mode-switch button", { hasText: "Agent Builder" }).click();
    await sleep(400);
    await page.locator(".sidebar-tabs button", { hasText: "Templates" }).click();
    const useTpl = page.locator('button.pattern-use-btn:has-text("Use template")').first();
    if ((await useTpl.count()) > 0) await useTpl.click();
    await sleep(1000);
  }
  await shot(page, ".canvas-column", path.join(DEV, "17-agent-canvas.png"));
  await page.screenshot({ path: path.join(DEV, "17-agent-full-app.png") });

  // ── Dev 18: Agent block palette ──
  await page.locator(".sidebar-tabs button", { hasText: "Blocks" }).click();
  await sleep(400);
  await shot(page, ".designer-sidebar", path.join(DEV, "18-agent-blocks-palette.png"));

  // ── Dev 19: Agent properties ──
  await page.locator(".sidebar-tabs button", { hasText: "Templates" }).click();
  await sleep(200);
  const agentNode = page.locator(".agent-canvas .react-flow__node").first();
  if ((await agentNode.count()) > 0) {
    await page.locator(".sidebar-tabs button", { hasText: "Blocks" }).click();
    await sleep(200);
    await agentNode.click({ force: true });
    await sleep(500);
    await shot(page, ".agent-properties", path.join(DEV, "19-agent-properties-panel.png"));
    if (!(await page.locator(".agent-properties").count())) {
      await shot(page, ".properties", path.join(DEV, "19-agent-properties-panel.png"));
    }
  }

  // ── Dev 20: Agent manifest preview ──
  const manifestBtn = page.locator('button:has-text("Preview manifest")');
  if ((await manifestBtn.count()) > 0) {
    await manifestBtn.click();
    await sleep(800);
    await shot(page, ".agent-preview-panel", path.join(DEV, "20-agent-manifest-preview.png"));
    if (!(await page.locator(".agent-preview-panel").count())) {
      await shot(page, ".deploy-panel", path.join(DEV, "20-agent-manifest-preview.png"));
    }
  }

  // ── Dev 21: Kappa overview (design review) ──
  await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
  await sleep(400);
  await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
  await sleep(200);
  await page.locator(".pattern-arch-filters button", { hasText: "Kappa" }).click();
  await sleep(300);
  const kappaUse = page.locator("button.pattern-use-btn").first();
  if ((await kappaUse.count()) > 0) await kappaUse.click();
  await sleep(2500);
  await page.screenshot({ path: path.join(DEV, "21-kappa-design-review.png") });
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, "portal", "dist", "index.html"))) {
    console.error("Run: npm run build --prefix portal");
    process.exit(1);
  }

  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(IMAGES, { recursive: true });
  fs.mkdirSync(DEV, { recursive: true });

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

    // ── README / PORTAL_UI assets ──
    await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
    await sleep(500);
    const firstCard = page.locator(".pattern-card-header").first();
    if ((await firstCard.count()) > 0) await firstCard.click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-pattern-library.png"),
    });

    await page.locator(".pattern-arch-filters button", { hasText: "Data Mesh" }).click();
    await sleep(300);
    const meshBtn = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
    if ((await meshBtn.count()) > 0) await meshBtn.click();
    await sleep(1000);
    await page.locator(".canvas-column").screenshot({
      path: path.join(ASSETS, "portal-canvas-datamesh.png"),
    });
    await page.locator(".canvas-column").screenshot({
      path: path.join(IMAGES, "cog1-datamesh-canvas.png"),
    });

    await page.locator(".pattern-arch-filters button", { hasText: "Lambda" }).click();
    await sleep(300);
    const lambdaUse = page.locator('button.pattern-use-btn:has-text("Use pattern")').first();
    if ((await lambdaUse.count()) > 0) await lambdaUse.click();
    await sleep(1000);
    await page.locator(".canvas-column").screenshot({
      path: path.join(IMAGES, "cog2-lambda-canvas.png"),
    });

    await page.locator(".sidebar-tabs button", { hasText: "AWS Blocks" }).click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-aws-blocks.png"),
    });

    await page.locator(".sidebar-tabs button", { hasText: "AI Builder" }).click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(ASSETS, "portal-ai-builder.png"),
    });
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(IMAGES, "portal-ai-pipeline-designer.png"),
    });

    await page.locator(".ai-builder-mode-tabs button", { hasText: "AI agent" }).click();
    await sleep(400);
    await page.locator(".designer-sidebar").screenshot({
      path: path.join(IMAGES, "portal-ai-agent-generator.png"),
    });

    await page.locator(".designer-mode-switch button", { hasText: "Agent Builder" }).click();
    await sleep(500);
    await page.locator(".sidebar-tabs button", { hasText: "Templates" }).click();
    await sleep(300);
    const agentUse = page.locator('button.pattern-use-btn:has-text("Use template")').first();
    if ((await agentUse.count()) > 0) await agentUse.click();
    await sleep(1000);
    await page.locator(".canvas-column").screenshot({
      path: path.join(IMAGES, "portal-agent-builder-canvas.png"),
    });
    await page.screenshot({
      path: path.join(IMAGES, "portal-agent-builder-full.png"),
      fullPage: false,
    });

    await page.locator(".designer-mode-switch button", { hasText: "Data Pipeline" }).click();
    await sleep(400);

    await page.locator(".sidebar-tabs button", { hasText: "Architectures" }).click();
    await sleep(200);
    await page.locator(".pattern-arch-filters button", { hasText: "Kappa" }).click();
    await sleep(300);
    const kappaUse = page.locator("button.pattern-use-btn").first();
    if ((await kappaUse.count()) > 0) await kappaUse.click();
    await sleep(2500);
    await page.screenshot({ path: path.join(ASSETS, "portal-overview.png"), fullPage: false });

    // ── Developer guide screenshots (21 images) ──
    try {
      await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
      await sleep(800);
      await captureDeveloperDocs(page);
    } catch (err) {
      console.warn("Developer screenshots partial:", err.message);
    }

    await browser.close();
    console.log("Saved screenshots to docs/assets/, docs/images/, and docs/images/dev/");
  } finally {
    portal.kill("SIGTERM");
    api.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
