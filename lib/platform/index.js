"use strict";

const { graphToContractSmart } = require("../contract-builder/graph-to-contract-smart");
const { getLiveDashboard } = require("./live-dashboard");
const { previewSourceData } = require("./data-preview");
const { deployAgentToAws } = require("./agent-deploy");
const {
  listPipelineVersions,
  rollbackPayload,
  savePipelineVersion,
} = require("./pipeline-versions");
const { getNotificationConfig } = require("./notifications");
const { computeHealthScore, listProductHealthScores } = require("./health-score");
const { analyzeDeployImpact } = require("./impact-analysis");
const { estimatePipelineCost, listDomainCosts } = require("./cost-attribution");
const { buildColumnLineage } = require("./column-lineage");
const { attemptSelfHeal, selfHealPipeline } = require("./self-healing");
const { diffPipelineVersions } = require("./version-diff");
const {
  isDeployApprovalRequired,
  queueDeployApproval,
  listPendingDeployApprovals,
  rejectDeploy,
} = require("./deploy-approval");
const { listDeployTargets, compileForTarget } = require("./multi-cloud");
const { listFederatedProducts } = require("./federated-mesh");
const { listPlugins, registerPlugin } = require("./plugins");
const { copilotRespond } = require("./copilot");
const { subscribeSla, listSlaSubscriptions, checkSlaCompliance } = require("./sla-marketplace");
const { generateAuditReport } = require("./audit-report");
const { validateBusinessRules, rulesToSparkExpressions, RULE_TYPES } = require("./data-quality-rules");

function mountPlatformRoutes(app, { requireAuth }) {
  app.get("/api/v1/platform/dashboard", requireAuth, (_req, res) => {
    res.json(getLiveDashboard());
  });

  app.get("/api/v1/platform/versions/diff", requireAuth, (req, res) => {
    const { leftId, rightId } = req.query;
    if (!leftId || !rightId) {
      return res.status(400).json({ success: false, errors: ["leftId and rightId required"] });
    }
    res.json(diffPipelineVersions(leftId, rightId));
  });

  app.get("/api/v1/platform/versions/:domain/:name", requireAuth, (req, res) => {
    res.json({ versions: listPipelineVersions(req.params.domain, req.params.name) });
  });

  app.get("/api/v1/platform/versions/rollback/:versionId", requireAuth, (req, res) => {
    const result = rollbackPayload(req.params.versionId);
    res.status(result.success ? 200 : 404).json(result);
  });

  app.post("/api/v1/platform/preview-source", requireAuth, async (req, res) => {
    const { nodes, edges, pipelineMeta, limit } = req.body || {};
    const graph = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
    if (!graph.success) {
      return res.status(400).json({ status: "error", errors: graph.errors });
    }
    const result = await previewSourceData(graph.contract, { limit: limit || 10 });
    res.json(result);
  });

  app.post("/api/v1/agents/deploy", requireAuth, async (req, res) => {
    const { manifest } = req.body || {};
    if (!manifest?.metadata?.name) {
      return res.status(400).json({ status: "error", errors: ["manifest required"] });
    }
    const result = await deployAgentToAws(manifest, { userEmail: req.auth?.email });
    res.status(result.deployed || result.simulated ? 200 : 422).json(result);
  });

  app.get("/api/v1/platform/notifications/config", requireAuth, (_req, res) => {
    res.json(getNotificationConfig());
  });

  app.post("/api/v1/platform/notifications/test", requireAuth, async (req, res) => {
    const { notifyPipelineFailure } = require("./notifications");
    const result = await notifyPipelineFailure({
      pipelineName: req.body?.pipelineName || "test-pipeline",
      domain: req.body?.domain || "test",
      errors: ["Test notification from CogniMesh portal"],
      stage: "test",
    });
    res.json(result);
  });

  app.get("/api/v1/platform/health", requireAuth, (req, res) => {
    const { domain, name } = req.query;
    if (name) {
      return res.json(computeHealthScore({ domain, name }));
    }
    res.json({ products: listProductHealthScores(domain) });
  });

  app.post("/api/v1/platform/impact", requireAuth, (req, res) => {
    const { nodes, edges, pipelineMeta, changedColumns } = req.body || {};
    const graph = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
    if (!graph.success) {
      return res.status(400).json({ status: "error", errors: graph.errors });
    }
    res.json(analyzeDeployImpact(graph.contract, { changedColumns }));
  });

  app.get("/api/v1/platform/costs", requireAuth, (req, res) => {
    const domain = req.query.domain;
    res.json({ products: listDomainCosts(domain) });
  });

  app.post("/api/v1/platform/costs/estimate", requireAuth, (req, res) => {
    const { nodes, edges, pipelineMeta } = req.body || {};
    const graph = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
    if (!graph.success) {
      return res.status(400).json({ status: "error", errors: graph.errors });
    }
    res.json(estimatePipelineCost(graph.contract));
  });

  app.get("/api/v1/platform/audit-report", requireAuth, (req, res) => {
    const report = generateAuditReport({ domain: req.query.domain });
    const format = req.query.format || "json";
    if (format === "markdown") {
      res.type("text/markdown").send(report.markdown);
      return;
    }
    res.json(report);
  });

  app.post("/api/v1/platform/column-lineage", requireAuth, (req, res) => {
    const { nodes, edges, pipelineMeta } = req.body || {};
    const graph = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
    if (!graph.success) {
      return res.status(400).json({ status: "error", errors: graph.errors });
    }
    res.json(buildColumnLineage(graph.contract));
  });

  app.post("/api/v1/platform/self-heal/pipeline", requireAuth, async (req, res) => {
    const { domain, pipelineName } = req.body || {};
    if (!pipelineName) {
      return res.status(400).json({ healed: false, errors: ["pipelineName required"] });
    }
    const result = await selfHealPipeline({ domain, pipelineName });
    res.json(result);
  });

  app.get("/api/v1/platform/deploy-approvals", requireAuth, (_req, res) => {
    res.json({
      required: isDeployApprovalRequired(),
      pending: listPendingDeployApprovals(),
    });
  });

  app.post("/api/v1/platform/deploy-approvals/:id/reject", requireAuth, (req, res) => {
    const result = rejectDeploy(req.params.id, req.auth?.sub, req.body?.reason);
    res.status(result.success ? 200 : 404).json(result);
  });

  app.post("/api/v1/platform/self-heal", requireAuth, async (req, res) => {
    const { contract, source_rows, workload_id, gateResult } = req.body || {};
    const result = await attemptSelfHeal({ contract, source_rows, workload_id, gateResult });
    res.json(result);
  });

  app.get("/api/v1/platform/deploy-targets", requireAuth, (_req, res) => {
    res.json({ targets: listDeployTargets() });
  });

  app.post("/api/v1/platform/compile-target", requireAuth, (req, res) => {
    const { nodes, edges, pipelineMeta, target } = req.body || {};
    const graph = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
    if (!graph.success) {
      return res.status(400).json({ status: "error", errors: graph.errors });
    }
    res.json(compileForTarget(graph.contract, target || "aws"));
  });

  app.get("/api/v1/platform/federated-products", requireAuth, async (req, res) => {
    res.json(await listFederatedProducts(req.auth));
  });

  app.get("/api/v1/platform/plugins", requireAuth, (_req, res) => {
    res.json({ plugins: listPlugins() });
  });

  app.post("/api/v1/platform/plugins", requireAuth, (req, res) => {
    res.json(registerPlugin(req.body || {}));
  });

  app.post("/api/v1/platform/copilot", requireAuth, (req, res) => {
    const { message, pipelineName, domain } = req.body || {};
    res.json(copilotRespond({ message, pipelineName, domain }));
  });

  app.get("/api/v1/platform/sla", requireAuth, (req, res) => {
    res.json({ subscriptions: listSlaSubscriptions(req.query.productId) });
  });

  app.post("/api/v1/platform/sla", requireAuth, (req, res) => {
    res.status(201).json(subscribeSla(req.body || {}));
  });

  app.get("/api/v1/platform/sla/check", requireAuth, (req, res) => {
    res.json(checkSlaCompliance({
      productId: req.query.productId,
      lastRunAt: req.query.lastRunAt,
    }));
  });

  app.get("/api/v1/platform/open-spec", requireAuth, (_req, res) => {
    res.json({
      spec: "cognimesh.io/v1",
      schemaUrl: "/schemas/data-contract-v1.schema.json",
      agentSpec: "agentcore.cognimesh/v1",
      status: "reference-implementation",
      publishUrl: "https://github.com/vaquarkhan/CogniMesh",
    });
  });

  app.get("/api/v1/platform/dq/rule-types", requireAuth, (_req, res) => {
    res.json({ ruleTypes: RULE_TYPES });
  });

  app.post("/api/v1/platform/dq/validate", requireAuth, (req, res) => {
    const result = validateBusinessRules(req.body?.rules || []);
    res.json({
      ...result,
      sparkExpressions: result.valid ? rulesToSparkExpressions(result.rules) : [],
    });
  });
}

module.exports = {
  mountPlatformRoutes,
  savePipelineVersion,
  getLiveDashboard,
  previewSourceData,
  deployAgentToAws,
  computeHealthScore,
  analyzeDeployImpact,
  estimatePipelineCost,
  buildColumnLineage,
  attemptSelfHeal,
  selfHealPipeline,
  generateAuditReport,
  isDeployApprovalRequired,
  queueDeployApproval,
  listPendingDeployApprovals,
  rejectDeploy,
  getDeployApproval: require("./deploy-approval").getDeployApproval,
  approveDeploy: require("./deploy-approval").approveDeploy,
  diffPipelineVersions,
};
