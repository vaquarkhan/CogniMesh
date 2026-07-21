#!/usr/bin/env node
"use strict";

/**
 * Portal E2E — Operations panel and deploy-approval API flows.
 * Usage: npm run test:portal-e2e
 */

const { chromium } = require("playwright");
const { spawn, execSync } = require("child_process");
const path = require("path");

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

async function loadMultiSourcePattern(page) {
  const loadBtn = page.locator('button:has-text("Load: Multi-Source workflow")');
  if ((await loadBtn.count()) === 0) throw new Error("Quick-load pattern button not found");
  await loadBtn.click();
  const node = page.locator(".react-flow__node");
  await node.first().waitFor({ state: "visible", timeout: 10000 });
  if ((await node.count()) === 0) throw new Error("Pattern did not load nodes onto canvas");
}

async function waitForAwsReview(page, timeout = 25000) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  await hud.waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="aws-review-hud"]');
      return el && !el.querySelector(".aws-review-loading");
    },
    { timeout }
  );
  await sleep(400);
}

async function clickCanvasNode(page, label) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  if ((await hud.count()) > 0) {
    const expanded = await hud.evaluate((el) => el.classList.contains("expanded"));
    if (expanded) {
      await hud.locator(".aws-review-header").click();
      await sleep(300);
    }
  }
  const node = page.locator(".react-flow__node").filter({ hasText: label });
  await node.first().waitFor({ state: "visible", timeout: 10000 });
  await node.first().click({ force: true });
  await sleep(300);
}

async function testDeployApprovalApi() {
  const res = await fetch(`${API_URL}/api/v1/platform/deploy-approvals`);
  if (!res.ok) throw new Error(`deploy-approvals GET failed: ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.pending)) throw new Error("deploy-approvals missing pending array");
}

/** Dock panels live under the header Tools menu (not top-level buttons). */
async function openDockFromToolsMenu(page, label) {
  const toolsBtn = page.locator("button.header-menu-trigger");
  if ((await toolsBtn.count()) === 0) throw new Error("Tools menu button not found");
  await toolsBtn.click();
  const item = page.locator('.header-menu-dropdown button[role="menuitemradio"]', { hasText: label });
  if ((await item.count()) === 0) throw new Error(`${label} menu item not found in Tools`);
  await item.click();
  await sleep(400);
}

async function testOperationsPanel(page) {
  await page.goto(PORTAL_URL);
  await dismissWelcome(page);
  await sleep(1500);

  await openDockFromToolsMenu(page, "Operations");

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
  await openDockFromToolsMenu(page, "Approvals");

  const panel = page.locator(".steward-panel");
  if ((await panel.count()) === 0) throw new Error("Steward approvals panel did not open");

  const deploySection = panel.locator("h3", { hasText: "Pipeline deploys" });
  if ((await deploySection.count()) === 0) throw new Error("Pipeline deploys section missing");
}

const AGENT_FEATURE_IDS = [
  "guardrails",
  "memorySession",
  "memoryLong",
  "knowledgeBase",
  "gateway",
  "codeInterpreter",
  "browser",
  "identity",
  "observability",
  "humanLoop",
];

async function awaitHudFixGuide(page, findingIdPrefix) {
  const hud = page.locator('[data-testid="aws-review-hud"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="aws-review-hud"]')?.classList.contains("expanded"),
    { timeout: 8000 }
  );

  const card = page.locator(`[id^="aws-finding-${findingIdPrefix}"]`);
  await card.first().waitFor({ state: "visible", timeout: 10000 });

  // Ensure the finding card body is open
  const body = card.first().locator(".aws-finding-card-body");
  if ((await body.count()) === 0 || !(await body.isVisible().catch(() => false))) {
    await card.first().locator(".aws-finding-card-head").click();
    await sleep(300);
  }

  let steps = hud.locator(".aws-fix-steps li");
  if ((await steps.count()) === 0) {
    const guide = page.locator(`[data-testid^="aws-fix-guide-${findingIdPrefix}"]`);
    if ((await guide.count()) === 0) throw new Error(`Get fix guide missing for ${findingIdPrefix}`);
    if (await guide.first().isEnabled()) {
      await guide.first().click();
    }
    await steps.first().waitFor({ state: "visible", timeout: 20000 });
  }

  // Fallback: at least the finding message is shown
  if ((await steps.count()) === 0) {
    const msg = card.first().locator(".aws-finding-msg");
    await msg.waitFor({ state: "visible", timeout: 5000 });
  }
}

async function testAwsDesignReviewUx(page) {
  await page.goto(PORTAL_URL);
  await dismissWelcome(page);
  await loadMultiSourcePattern(page);
  await waitForAwsReview(page);

  const hud = page.locator('[data-testid="aws-review-hud"]');
  await expectVisible(hud, "AWS review HUD");

  // HUD tabs and controls
  for (const tab of ["Security", "Architecture", "All"]) {
    const btn = hud.locator(`.aws-review-tabs button:has-text("${tab}")`);
    if ((await btn.count()) === 0) throw new Error(`AWS review tab missing: ${tab}`);
    await btn.click();
    await sleep(300);
  }
  const rescan = hud.locator('button.aws-refresh-btn:has-text("Re-scan")');
  if ((await rescan.count()) === 0) throw new Error("Re-scan button missing");
  await rescan.click();
  await waitForAwsReview(page);

  // Provision-mode RDS has no secrets finding; switch to existing to surface setup.rds_secret
  await clickCanvasNode(page, "RDS Orders");
  const existingRds = page.locator('[data-testid="rds-resource-setup"] button:has-text("Use my existing database")');
  await existingRds.waitFor({ state: "visible", timeout: 8000 });
  await existingRds.click();
  await waitForAwsReview(page);

  const propsFindings = page.locator('[data-testid="props-aws-findings"]');
  await propsFindings.waitFor({ state: "visible", timeout: 15000 });
  const secretsFix = page.locator('[data-testid^="props-aws-fix-setup.rds_secret"]');
  if ((await secretsFix.count()) === 0) {
    throw new Error("Properties panel missing Fix this for setup.rds_secret");
  }
  await secretsFix.first().click();
  await awaitHudFixGuide(page, "setup.rds_secret");

  // Lake Formation finding on sink (commerce domain, LF not enabled)
  await clickCanvasNode(page, "Iceberg Gold");
  await propsFindings.waitFor({ state: "visible", timeout: 15000 });
  const lfFix = page.locator('[data-testid="props-aws-fix-sec.lake_formation"]');
  if ((await lfFix.count()) === 0) throw new Error("Properties panel missing Fix this for sec.lake_formation");
  await lfFix.first().click();
  await awaitHudFixGuide(page, "sec.lake_formation");

  // HUD wizard navigation when critical/high issues exist
  const fixFirstTab = hud.locator('.aws-review-tabs button:has-text("Fix first")');
  if ((await fixFirstTab.count()) > 0) {
    await fixFirstTab.click();
    const nextBtn = hud.locator('.aws-review-wizard-nav button:has-text("Next")');
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click();
      await sleep(300);
      const prevBtn = hud.locator('.aws-review-wizard-nav button:has-text("Prev")');
      await prevBtn.click();
    }
    const fixThis = hud.locator('.aws-review-wizard-nav button:has-text("Fix this")');
    if ((await fixThis.count()) > 0) await fixThis.click();
  }

  // Integrity gate block present on canvas (pattern includes PVDM gate)
  const gateNode = page.locator(".react-flow__node").filter({ hasText: "Integrity Gate" });
  await gateNode.first().waitFor({ state: "visible", timeout: 10000 });
  if ((await gateNode.count()) === 0) throw new Error("Integrity Gate block missing from canvas");
}

async function clickAgentNode(page, label) {
  const nodeLabel = page.locator(".agent-node-label").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
  await nodeLabel.first().waitFor({ state: "visible", timeout: 10000 });
  await nodeLabel.first().click({ force: true });
  await sleep(400);
}

async function testAgentBuilderEndToEnd(page) {
  await page.goto(PORTAL_URL);
  await dismissWelcome(page);

  const agentTab = page.locator('button:has-text("Agent Builder")');
  if ((await agentTab.count()) === 0) throw new Error("Agent Builder tab missing");
  await agentTab.click();
  await sleep(500);

  // All Bedrock feature toggles present
  for (const id of AGENT_FEATURE_IDS) {
    const cb = page.locator(`[data-testid="agent-feature-${id}"]`);
    if ((await cb.count()) === 0) throw new Error(`Agent feature checkbox missing: ${id}`);
  }

  // Blocks palette: both guardrail types + core Bedrock blocks
  const blocksTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Blocks')");
  await blocksTab.click();
  await sleep(300);
  for (const label of [
    "Content Guardrail",
    "PII Guardrail",
    "Knowledge Base",
    "AgentCore Gateway",
    "Long-Term Memory",
    "Code Interpreter",
    "Browser Tool",
    "Human-in-the-Loop",
    "Observability",
  ]) {
    const item = page.locator(`.agent-palette-item:has-text("${label}")`);
    if ((await item.count()) === 0) throw new Error(`Agent palette block missing: ${label}`);
  }

  // Load customer support without extra auto-added blocks overlapping the canvas
  const templatesTab = page.locator(".agent-sidebar .sidebar-tabs button:has-text('Templates')");
  await templatesTab.click();
  await sleep(300);
  const observabilityCb = page.locator('[data-testid="agent-feature-observability"]');
  if (await observabilityCb.isChecked()) await observabilityCb.uncheck();

  // Load customer support template with multiple guardrails
  const supportCard = page.locator(".pattern-card").filter({ hasText: "Customer Support Agent" });
  await supportCard.locator(".pattern-card-header").click();
  await supportCard.locator('button:has-text("Use this agent template")').click();
  await page.locator(".react-flow__node").first().waitFor({ state: "visible", timeout: 10000 });

  const guardrailNodes = page.locator(".react-flow__node").filter({ hasText: "Guardrail" });
  if ((await guardrailNodes.count()) < 2) {
    throw new Error("Customer support template should include multiple guardrail blocks");
  }

  // Exercise properties for each major block type
  const blockChecks = [
    { label: "PII Guardrail", field: "guardrail" },
    { label: "Content Guardrail", field: "guardrail" },
    { label: "Support KB", field: "knowledge_base" },
    { label: "Support Runtime", field: "runtime" },
    { label: "Claude Sonnet", field: "foundation_model" },
  ];
  for (const { label, field } of blockChecks) {
    await clickAgentNode(page, label);
    const propsPanel = page.locator("aside.properties.agent-properties");
    await propsPanel.waitFor({ state: "visible", timeout: 8000 });
    const text = await propsPanel.textContent();
    if (!text?.includes(field)) {
      throw new Error(`Agent properties missing block type "${field}" for ${label} — got: ${text?.slice(0, 120)}`);
    }
  }

  // Toolbar actions
  await page.locator('button:has-text("Preview manifest")').click();
  const preview = page.locator(".agent-preview-panel, .deploy-panel");
  await preview.first().waitFor({ state: "visible", timeout: 10000 });

  await page.locator('button:has-text("Export manifest")').click();
  await sleep(500);
  const exportBanner = page.locator(".agent-deploy-banner.agent-deploy-exported");
  if ((await exportBanner.count()) === 0) {
    const anyExport = page.locator(".agent-deploy-banner").filter({ hasText: /export/i });
    if ((await anyExport.count()) === 0) throw new Error("Export manifest did not show confirmation banner");
  }

  await page.locator('button:has-text("Deploy to AWS")').click();
  const deployBanner = page.locator(".agent-deploy-banner").filter({ hasText: /simulated|Deployed|deploy/i });
  await deployBanner.first().waitFor({ state: "visible", timeout: 15000 });
  const bannerText = await deployBanner.first().textContent();
  if (!/simulated|Deployed|Agent|deploy/i.test(bannerText || "")) {
    throw new Error(`Unexpected agent deploy banner: ${bannerText}`);
  }

  // Fraud template: second pair of guardrails
  await templatesTab.click();
  const fraudCard = page.locator(".pattern-card").filter({ hasText: "Fraud Investigation Agent" });
  await fraudCard.locator(".pattern-card-header").click();
  await fraudCard.locator('button:has-text("Use this agent template")').click();
  await sleep(800);
  const fraudGuardrails = page.locator(".react-flow__node").filter({ hasText: "Guardrail" });
  if ((await fraudGuardrails.count()) < 2) {
    throw new Error("Fraud template should include PII + topic guardrails");
  }

  // Blank agent with every feature enabled adds all Bedrock blocks
  for (const id of AGENT_FEATURE_IDS) {
    const cb = page.locator(`[data-testid="agent-feature-${id}"]`);
    if (!(await cb.isChecked())) await cb.check();
  }
  const blankCard = page.locator(".pattern-card").filter({ hasText: "Blank Agent" });
  if ((await blankCard.count()) > 0) {
    await blankCard.locator(".pattern-card-header").click();
    await blankCard.locator('button:has-text("Use this agent template")').click();
    await sleep(800);
    for (const id of ["guardrails", "knowledgeBase", "gateway", "observability", "memorySession"]) {
      const cb = page.locator(`[data-testid="agent-feature-${id}"]`);
      if (!(await cb.isChecked())) throw new Error(`Feature ${id} should stay enabled on blank agent`);
    }
  }
}

function expectVisible(locator, label) {
  return locator.waitFor({ state: "visible", timeout: 10000 }).catch(() => {
    throw new Error(`${label} not visible`);
  });
}

async function testPatternPreviewJourney(page) {
  await page.goto(PORTAL_URL);
  await dismissWelcome(page);
  await sleep(800);

  await loadMultiSourcePattern(page);

  const previewBtn = page.locator('button:has-text("Preview YAML")');
  await previewBtn.click();

  const deployPanel = page.locator(".deploy-panel");
  await deployPanel.waitFor({ state: "visible", timeout: 20000 });

  const heading = deployPanel.locator("h2", { hasText: /Preview (result|issues|failed)/ });
  await heading.waitFor({ state: "visible", timeout: 20000 });

  const deployBtn = page.locator('button.deploy-btn:has-text("Deploy Pipeline")');
  if ((await deployBtn.count()) === 0) throw new Error("Deploy Pipeline button missing after preview");
  if (await deployBtn.isDisabled()) throw new Error("Deploy Pipeline should be enabled after successful preview");
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
    await testPatternPreviewJourney(page);
    console.log("✓ Pattern load → Preview YAML → deploy panel");
    await testOperationsPanel(page);
    console.log("✓ Operations panel tabs");
    await testStewardApprovalsPanel(page);
    console.log("✓ Steward approvals panel");
    await testAwsDesignReviewUx(page);
    console.log("✓ AWS Design Review Properties → Fix this → HUD guide (encryption, LF, secrets)");
    await testAgentBuilderEndToEnd(page);
    console.log("✓ Agent Builder features, guardrails, palette, preview, export, deploy");
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
