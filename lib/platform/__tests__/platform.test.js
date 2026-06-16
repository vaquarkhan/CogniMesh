"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { previewSourceData } = require("../data-preview");
const { savePipelineVersion, listPipelineVersions, rollbackPayload } = require("../pipeline-versions");
const { analyzeDeployImpact } = require("../impact-analysis");
const { computeHealthScore } = require("../health-score");
const { buildColumnLineage } = require("../column-lineage");
const { validateBusinessRules, rulesToSparkExpressions } = require("../data-quality-rules");
const { copilotRespond } = require("../copilot");
const { listDeployTargets } = require("../multi-cloud");
const { diffContracts, diffPipelineVersions } = require("../version-diff");
const { queueDeployApproval, listPendingDeployApprovals, isDeployApprovalRequired } = require("../deploy-approval");
const { auditReportToHtml } = require("../audit-html");
const { generateAuditReport } = require("../audit-report");
const { aslToCanvas, importFromGlueJob } = require("../import-aws");
const { copilotRespondAsync } = require("../copilot-llm");
const { sandboxCompilePlugin, validatePluginManifest } = require("../plugin-sandbox");
const { generateOpenSpecSite, getOpenSpecMeta } = require("../open-spec-site");
const { getBillingDashboard, recordBillingEvent } = require("../cross-org-billing");
const { parseJdbcUrl, previewJdbcSource } = require("../data-preview-jdbc");
const { registerPlugin } = require("../plugins");

const sampleContract = {
  metadata: { name: "orders", domain: "commerce", version: "1.0.0" },
  spec: {
    source: {
      type: "rds",
      connection: { table: "orders" },
      schema: [
        { name: "order_id", type: "string" },
        { name: "revenue", type: "decimal" },
      ],
    },
    transform: { type: "spark_sql", layers: ["bronze", "silver"] },
    target: { catalog: { table: "orders_curated" } },
    schemaEvolution: { policy: "compatible" },
  },
};

describe("platform modules", () => {
  it("previewSourceData returns sample rows", async () => {
    const r = await previewSourceData(sampleContract, { limit: 3 });
    assert.equal(r.rows.length, 3);
    assert.ok(r.columns.includes("order_id"));
  });

  it("pipeline version save and rollback", () => {
    const v1 = savePipelineVersion({
      contract: sampleContract,
      manifestYaml: "metadata:\n  name: orders\n",
      nodes: [{ id: "n1" }],
      edges: [],
    });
    const v2 = savePipelineVersion({
      contract: {
        ...sampleContract,
        metadata: { ...sampleContract.metadata, version: "1.1.0" },
        spec: {
          ...sampleContract.spec,
          source: {
            ...sampleContract.spec.source,
            schema: [...sampleContract.spec.source.schema, { name: "region", type: "string" }],
          },
        },
      },
      manifestYaml: "metadata:\n  name: orders\n  version: 1.1.0\n",
      nodes: [{ id: "n1" }],
      edges: [],
    });
    const versions = listPipelineVersions("commerce", "orders");
    assert.ok(versions.length >= 2);
    const rolled = rollbackPayload(versions[0].id);
    assert.equal(rolled.success, true);
    assert.ok(rolled.nodes);
    const diff = diffPipelineVersions(v1.id, v2.id);
    assert.equal(diff.success, true);
    assert.ok(diff.diff.schema.addedColumns.includes("region"));
  });

  it("diffContracts detects schema changes", () => {
    const next = {
      ...sampleContract,
      metadata: { ...sampleContract.metadata, version: "2.0.0" },
      spec: {
        ...sampleContract.spec,
        source: { ...sampleContract.spec.source, schema: [{ name: "order_id", type: "string" }] },
      },
    };
    const d = diffContracts(sampleContract, next);
    assert.ok(d.schema.removedColumns.includes("revenue"));
  });

  it("deploy approval queue", () => {
    const prev = process.env.DEPLOY_APPROVAL_REQUIRED;
    process.env.DEPLOY_APPROVAL_REQUIRED = "true";
    assert.equal(isDeployApprovalRequired(), true);
    const q = queueDeployApproval({
      nodes: [{ id: "n1" }],
      edges: [],
      pipelineMeta: { name: "orders", domain: "commerce", version: "1.0.0" },
      userEmail: "test@example.com",
    });
    assert.ok(q.id);
    assert.ok(listPendingDeployApprovals().some((p) => p.id === q.id));
    process.env.DEPLOY_APPROVAL_REQUIRED = prev;
  });

  it("analyzeDeployImpact returns blast radius", () => {
    const r = analyzeDeployImpact(sampleContract, { changedColumns: ["revenue"] });
    assert.ok(["low", "medium", "high"].includes(r.blastRadius));
    assert.ok(r.affectedConsumers.length >= 0);
  });

  it("computeHealthScore returns score 0-100", () => {
    const r = computeHealthScore({ domain: "commerce", name: "orders" });
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(r.grade);
  });

  it("buildColumnLineage maps schema columns", () => {
    const r = buildColumnLineage(sampleContract);
    assert.equal(r.columns.length, 2);
    assert.equal(r.columns[0].column, "order_id");
  });

  it("validateBusinessRules catches missing column", () => {
    const r = validateBusinessRules([{ type: "not_null" }]);
    assert.equal(r.valid, false);
    assert.ok(r.errors.length);
  });

  it("rulesToSparkExpressions builds SQL fragments", () => {
    const sql = rulesToSparkExpressions([
      { column: "revenue", type: "gt_zero" },
      { column: "email", type: "regex", value: "^.+@.+$" },
    ]);
    assert.ok(sql[0].includes("revenue > 0"));
    assert.ok(sql[1].includes("RLIKE"));
  });

  it("copilotRespond returns a reply", () => {
    const r = copilotRespond({ message: "why did vrp fail", pipelineName: "orders" });
    assert.ok(r.reply);
    assert.ok(Array.isArray(r.suggestions));
  });

  it("listDeployTargets includes aws", () => {
    const targets = listDeployTargets();
    assert.ok(targets.some((t) => t.id === "aws"));
  });

  it("auditReportToHtml wraps markdown", () => {
    const report = generateAuditReport({ domain: "commerce" });
    const html = auditReportToHtml(report);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("CogniMesh Audit Report"));
  });

  it("aslToCanvas builds nodes from ASL", () => {
    const canvas = aslToCanvas(
      { StartAt: "A", States: { A: { Type: "Task", Resource: "arn:aws:states:::glue:startJobRun", End: true } } },
      { name: "test", domain: "d" }
    );
    assert.ok(canvas.nodes.length >= 2);
    assert.ok(canvas.pipelineMeta.name === "test");
  });

  it("importFromGlueJob returns canvas", async () => {
    const r = await importFromGlueJob({ jobName: "etl-job", domain: "commerce" });
    assert.equal(r.success, true);
    assert.ok(r.nodes.length >= 3);
  });

  it("copilotRespondAsync uses rules when LLM disabled", async () => {
    const prev = process.env.COPILOT_LLM_ENABLED;
    process.env.COPILOT_LLM_ENABLED = "false";
    const r = await copilotRespondAsync({ message: "vrp fail", pipelineName: "orders", domain: "commerce" });
    assert.equal(r.mode, "rules");
    assert.ok(r.reply);
    process.env.COPILOT_LLM_ENABLED = prev;
  });

  it("plugin sandbox validates and compiles", () => {
    const bad = validatePluginManifest({ type: "sink" });
    assert.equal(bad.valid, false);
    const ok = sandboxCompilePlugin({
      id: "test-src",
      type: "source",
      label: "Test Source",
    });
    assert.equal(ok.success, true);
    assert.ok(ok.block.defaults.pluginId === "test-src");
  });

  it("registerPlugin persists custom block", () => {
    const r = registerPlugin({
      id: `unit-plugin-${Date.now()}`,
      type: "sink",
      label: "Unit Sink",
    });
    assert.equal(r.success, true);
    assert.ok(r.compiled.block);
  });

  it("open spec site generates HTML", () => {
    const html = generateOpenSpecSite();
    assert.ok(html.includes("cognimesh.io/v1"));
    assert.ok(getOpenSpecMeta().siteUrl);
  });

  it("billing dashboard records events", () => {
    recordBillingEvent({ orgId: "org-test", productId: "p1", eventType: "query", units: 10 });
    const dash = getBillingDashboard({ orgId: "org-test" });
    assert.ok(dash.totalUsd >= 0);
    assert.ok(dash.organizations.length >= 1);
  });

  it("jdbc preview parses url", async () => {
    const parsed = parseJdbcUrl("jdbc:postgresql://localhost:5432/shop");
    assert.equal(parsed.database, "shop");
    const preview = await previewJdbcSource(
      { jdbcUrl: "jdbc:postgresql://localhost:5432/shop", table: "orders" },
      { limit: 3 }
    );
    assert.equal(preview.success, true);
    assert.equal(preview.rows.length, 3);
  });
});
