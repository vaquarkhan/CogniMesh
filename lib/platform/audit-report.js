"use strict";

const { listRecent } = require("../audit-log");
const { listRuns, stats } = require("../execution-history");
const { listLineageCatalog } = require("../lineage-catalog");
const { listPending } = require("../access-requests");
const { listProductHealthScores } = require("./health-score");

function generateAuditReport({ domain } = {}) {
  const generatedAt = new Date().toISOString();
  const executions = stats();
  const runs = listRuns({ domain, limit: 50 });
  const lineage = listLineageCatalog(domain);
  const access = listPending();
  const health = listProductHealthScores(domain);
  const events = listRecent(200);

  const markdown = [
    `# CogniMesh Audit Report`,
    ``,
    `Generated: ${generatedAt}`,
    domain ? `Domain filter: ${domain}` : "",
    ``,
    `## Executive summary`,
    `- Pipelines tracked: ${lineage.length}`,
    `- Total runs: ${executions.total} (${executions.succeeded} succeeded)`,
    `- Pending access requests: ${access.length}`,
    `- Average health score: ${health.length ? Math.round(health.reduce((a, h) => a + h.health.score, 0) / health.length) : "n/a"}`,
    ``,
    `## Pipelines & VRP history`,
    ...runs.slice(0, 20).map(
      (r) =>
        `- **${r.domain}/${r.pipelineName}** v${r.version || "?"} — ${r.outcome} — VRP ${r.vrpVerdict || "n/a"} — ${r.ts}`
    ),
    ``,
    `## Access grants (pending)`,
    ...access.map((a) => `- ${a.productName || a.productId} — ${a.userEmail || a.userId} — ${a.status}`),
    ``,
    `## Health scores`,
    ...health.map((h) => `- ${h.domain}/${h.name}: **${h.health.score}** (${h.health.grade})`),
    ``,
    `## Recent audit events`,
    ...events.slice(0, 30).map((e) => `- ${e.ts} — ${e.action} — ${e.user_id || "system"}`),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    generatedAt,
    format: "markdown",
    markdown,
    summary: {
      pipelines: lineage.length,
      pipelinesTracked: lineage.length,
      runs: executions.total,
      pendingAccess: access.length,
      events: events.length,
    },
  };
}

module.exports = { generateAuditReport };
