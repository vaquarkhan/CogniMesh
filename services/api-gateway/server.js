"use strict";

const path = require("path");
require("../../lib/load-env").loadRepoEnv({ root: path.join(__dirname, "../..") });
const { exitOnProductionAuthMisconfig } = require("../../lib/auth-production-guard");
exitOnProductionAuthMisconfig();
require("../../lib/tracing-otel").initOtel();

const express = require("express");
const cors = require("cors");
const { deployPipeline, previewPipeline } = require("../../lib/contract-builder");
const { requireAuth } = require("./middleware/auth");
const { csrfProtection } = require("./middleware/csrf");
const { securityHeaders } = require("./middleware/security-headers");
const { rateLimit } = require("./middleware/rate-limit");
const { requestLogger, structuredLog } = require("./middleware/logger");
const {
  listProducts,
  getProduct,
  catalogReachable,
  fallbackEnabled,
  catalogStorageMode,
} = require("../../lib/catalog-client");
const { record: auditRecord } = require("../../lib/audit-log");
const {
  getLineage,
  listLineageCatalog,
  lineageCatalogSummary,
} = require("../../lib/lineage-catalog");
const { listRuns, stats: executionStats, recordRun } = require("../../lib/execution-history");
const metrics = require("../../lib/metrics");
const { startSpan } = require("../../lib/tracing");
const { mountPlatformRoutes, savePipelineVersion, isDeployApprovalRequired, queueDeployApproval, approveDeploy } = require("../../lib/platform");
const { mountMarketplaceRoutes } = require("../../lib/marketplace/routes");

const { isAllowedOrigin } = require("./lib/cors-origins");

const PORT = process.env.PORT || 4000;
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:8080";

const app = express();
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CogniMesh-User",
      "X-CogniMesh-Client",
    ],
  })
);
const BODY_LIMIT = process.env.API_BODY_LIMIT || "512kb";
app.use(express.json({ limit: BODY_LIMIT }));
app.use(requestLogger);
app.use("/schemas", express.static(path.join(__dirname, "../../schemas")));
app.use("/api/v1", rateLimit);
app.use("/api/v1", csrfProtection);

mountPlatformRoutes(app, { requireAuth });
mountMarketplaceRoutes(app, { requireAuth });

async function deepHealth() {
  const embedded = fallbackEnabled();
  const catalogUp = embedded ? false : await catalogReachable();
  const authDisabled =
    process.env.AUTH_DISABLED === "true" ||
    (process.env.AUTH_DISABLED !== "false" &&
      !process.env.COGNITO_USER_POOL_ID &&
      process.env.NODE_ENV !== "production");
  const cognitoConfigured = Boolean(
    process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID
  );
  const awsDeploy = process.env.AWS_DEPLOY_ENABLED === "true";
  const awsRole = Boolean(process.env.AWS_STEP_FUNCTIONS_ROLE_ARN);
  const { isAgentDeployEnabled } = require("../../lib/platform/agent-deploy");
  const agentDeployEnabled = isAgentDeployEnabled();
  const agentRole = Boolean(process.env.AWS_BEDROCK_AGENT_ROLE_ARN?.trim());
  const { getLiveDashboard } = require("../../lib/platform");
  const platformDash = getLiveDashboard();

  const checks = {
    catalog: {
      ok: embedded || catalogUp,
      mode: catalogUp ? "remote" : embedded ? catalogStorageMode() : "unavailable",
    },
    auth: { ok: authDisabled || cognitoConfigured, mode: authDisabled ? "disabled" : cognitoConfigured ? "cognito" : "misconfigured" },
    aws_deploy: {
      ok: !awsDeploy || awsRole,
      enabled: awsDeploy,
      roleConfigured: awsRole,
      message: awsDeploy && !awsRole
        ? "AWS_DEPLOY_ENABLED=true but AWS_STEP_FUNCTIONS_ROLE_ARN is unset - deploy compiles locally only"
        : awsDeploy
          ? "Step Functions deploy enabled"
          : "Set AWS_DEPLOY_ENABLED=true and AWS_STEP_FUNCTIONS_ROLE_ARN after terraform apply",
      hint: "terraform -chdir=infra/terraform/environments/dev output -raw pipeline_orchestrator_role_arn",
    },
    aws_agent_deploy: {
      ok: !agentDeployEnabled || agentRole,
      enabled: agentDeployEnabled,
      roleConfigured: agentRole,
      message: agentDeployEnabled && !agentRole
        ? "Agent deploy enabled but AWS_BEDROCK_AGENT_ROLE_ARN is unset - deploy stays simulated"
        : agentDeployEnabled
          ? "Bedrock agent deploy enabled (CreateAgent + alias)"
          : "Set AWS_BEDROCK_AGENT_ROLE_ARN on the API server for real Bedrock deploy",
      hint: "terraform -chdir=infra/terraform/environments/dev output -raw bedrock_agent_role_arn",
    },
    lineage_catalog: { ok: true, products: lineageCatalogSummary().totalProducts },
    execution_history: { ok: true, ...executionStats() },
    platform_ops: {
      ok: true,
      pipelines: platformDash.summary?.pipelines ?? 0,
      features: [
        "dashboard",
        "versions",
        "impact",
        "preview",
        "billing",
        "plugins",
        "copilot",
        "import",
      ],
    },
  };

  const ok = Object.values(checks).every((c) => c.ok);
  return { ok, checks };
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.get("/metrics", metricsHandler);
app.get("/api/metrics", metricsHandler);

async function healthHandler(_req, res) {
  const { isOtelEnabled } = require("../../lib/tracing");
  const deep = await deepHealth();
  const otlp = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "";
  res.status(deep.ok ? 200 : 503).json({
    status: deep.ok ? "ok" : "degraded",
    service: "cognimesh-api-gateway",
    auth: process.env.AUTH_DISABLED === "true" ? "disabled" : "cognito",
    catalog: {
      url: CATALOG_URL,
      storage: catalogStorageMode(),
      reachable: deep.checks.catalog.mode === "remote",
      fallback: fallbackEnabled() ? catalogStorageMode() : "none",
    },
    otel: {
      enabled: isOtelEnabled(),
      serviceName: process.env.OTEL_SERVICE_NAME || "cognimesh-api-gateway",
      exporter: otlp
        ? "otlp-http"
        : process.env.OTEL_TRACES_EXPORTER === "console"
          ? "console"
          : process.env.OTEL_SDK_ENABLED === "true"
            ? "sdk-no-exporter"
            : "off",
      endpoint: otlp || null,
      hint:
        isOtelEnabled()
          ? null
          : "Set OTEL_SDK_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT (or OTEL_TRACES_EXPORTER=console). See docs/OPENTELEMETRY.md",
    },
    checks: deep.checks,
  });
}

function metricsHandler(_req, res) {
  res.json(
    metrics.snapshot({
      lineage: lineageCatalogSummary(),
      executions: executionStats(),
    })
  );
}

app.get("/api/v1/lineage/catalog", requireAuth, (req, res) => {
  const domain = req.query.domain;
  const summary = lineageCatalogSummary();
  const graphs = listLineageCatalog(domain);
  res.json({ ...summary, graphs });
});

app.get("/api/v1/products/:id/lineage", requireAuth, (req, res) => {
  const graph = getLineage(req.params.id);
  if (!graph) {
    return res.status(404).json({ status: "error", errors: ["Lineage not found for product"] });
  }
  res.json(graph);
});

app.get("/api/v1/pipelines/:name/history", requireAuth, (req, res) => {
  const domain = req.query.domain;
  res.json({
    runs: listRuns({ pipelineName: req.params.name, domain, limit: 20 }),
  });
});

app.get("/api/v1/pipelines/:name/observability", requireAuth, (req, res) => {
  const { pipelineObservability } = require("../../lib/execution-observability");
  const domain = req.query.domain;
  res.json(pipelineObservability({ pipelineName: req.params.name, domain, limit: 20 }));
});

app.post("/api/v1/pipelines/:name/backfill", requireAuth, (req, res) => {
  const { domain, startDate, endDate } = req.body || {};
  const run = recordRun({
    pipelineName: req.params.name,
    domain,
    outcome: "backfill_queued",
    message: `Backfill queued ${startDate || "?"} → ${endDate || "?"}`,
    userId: req.auth?.sub,
  });
  auditRecord({
    action: "pipeline_backfill",
    user_id: req.auth?.sub,
    pipeline: req.params.name,
    startDate,
    endDate,
  });
  res.json({ status: "success", run });
});

app.post("/api/v1/products/:id/access-requests", requireAuth, (req, res) => {
  const { requestAccess } = require("../../lib/access-requests");
  const record = requestAccess({
    productId: req.params.id,
    userId: req.auth?.sub,
    userEmail: req.auth?.email,
    reason: req.body?.reason,
    productName: req.body?.productName,
    domain: req.body?.domain,
  });
  auditRecord({
    action: "access_request",
    user_id: req.auth?.sub,
    product_id: req.params.id,
  });
  res.status(201).json(record);
});

app.get("/api/v1/access-requests/pending", requireAuth, (_req, res) => {
  const { listPending } = require("../../lib/access-requests");
  res.json({ requests: listPending() });
});

app.get("/api/v1/access-requests/mine", requireAuth, (req, res) => {
  const { listForUser } = require("../../lib/access-requests");
  res.json({ requests: listForUser(req.auth?.sub) });
});

app.get("/api/v1/products/:id/access-status", requireAuth, (req, res) => {
  const { getAccessForProduct } = require("../../lib/access-requests");
  const record = getAccessForProduct(req.params.id, req.auth?.sub);
  res.json({ access: record });
});

app.post("/api/v1/access-requests/:id/approve", requireAuth, (req, res) => {
  const { approveRequest } = require("../../lib/access-requests");
  const result = approveRequest(req.params.id, req.auth?.sub);
  if (!result.success) return res.status(404).json(result);
  auditRecord({ action: "access_approve", user_id: req.auth?.sub, request_id: req.params.id });
  res.json(result);
});

app.post("/api/v1/access-requests/:id/reject", requireAuth, (req, res) => {
  const { rejectRequest } = require("../../lib/access-requests");
  const result = rejectRequest(req.params.id, req.auth?.sub, req.body?.reason);
  if (!result.success) return res.status(404).json(result);
  auditRecord({ action: "access_reject", user_id: req.auth?.sub, request_id: req.params.id });
  res.json(result);
});

app.post("/api/v1/proofs/verify", requireAuth, (req, res) => {
  const span = startSpan("api.proofs.verify", { user_id: req.auth?.sub });
  const { verifyVrpProof } = require("../../lib/vrp/verify");
  try {
    const { proof, publicKeyPem, requireSignature } = req.body || {};
    if (!proof) {
      span.end("error", { code: "PROOF_REQUIRED" });
      return res.status(400).json({
        valid: false,
        error: "proof is required",
        code: "PROOF_REQUIRED",
        fixHint: "Paste a VRP JSON object from Run History, or use fixtures/vrp-conformance/identity-pass.json.",
      });
    }
    const result = verifyVrpProof(proof, {
      publicKeyPem,
      requireSignature: requireSignature !== false && Boolean(proof.signing?.signature || publicKeyPem),
      requireSnapshotPin: false,
      checkTransparencyLog: false,
    });
    span.end(result.valid ? "ok" : "error", { valid: String(result.valid), reason: result.reason || "" });
    res.json({
      valid: result.valid,
      reason: result.reason || null,
      checks: result.checks,
      proofId: proof.proof_id || null,
      verdict: proof.verdict || null,
      code: result.valid ? "PROOF_OK" : "PROOF_INVALID",
    });
  } catch (err) {
    span.end("error", { error: err.message });
    res.status(400).json({
      valid: false,
      error: err.message,
      code: err.code || "PROOF_VERIFY_FAILED",
      fixHint: "Ensure proof_version is 2 or 3 and multiset hashes are present. See docs/examples/proof-verify.md.",
    });
  }
});

app.post("/api/v1/proofs/diff", requireAuth, (req, res) => {
  const span = startSpan("api.proofs.diff", { user_id: req.auth?.sub });
  const { diffProofs } = require("../../lib/vrp/proof-diff");
  try {
    const { left, right } = req.body || {};
    const result = diffProofs(left, right);
    span.end("ok", { identical: String(result.identical) });
    res.json(result);
  } catch (err) {
    span.end("error", { error: err.message });
    res.status(400).json({
      error: err.message,
      code: err.code || "PROOF_DIFF_INVALID",
      fixHint: "Provide both left and right proof objects. Example: docs/examples/proof-verify.md",
    });
  }
});

app.post("/api/v1/gateway/serve", requireAuth, async (req, res) => {
  const { serveProofGatedDataset, ProofGatewayError } = require("../../lib/vrp/proof-gateway");
  try {
    const { sessionId, proof, localPath, limit } = req.body || {};
    const result = await serveProofGatedDataset({ sessionId, proof, localPath, limit });
    res.json({
      rows: result.rows,
      gatewayToken: result.gatewayToken,
      gatewayStamp: result.gatewayStamp,
      proofId: result.proof?.proof_id,
      verification: result.verification,
    });
  } catch (err) {
    const status = err instanceof ProofGatewayError ? 403 : 400;
    res.status(status).json({ error: err.message, code: err.code || "PROOF_GATEWAY_DENIED" });
  }
});

app.get("/api/v1/products/:id/consumer-detail", requireAuth, async (req, res) => {
  const { athenaConsoleUrl, parseSchemaFromManifest, sampleRowsFromSchema } = require("../../lib/athena-link");
  let product = null;
  try {
    const fetched = await getProduct(req.params.id, req.auth || {});
    product = fetched?.product || fetched;
  } catch {
    product = null;
  }
  const manifestYaml = product?.manifestYaml || "";
  const schema = parseSchemaFromManifest(manifestYaml);
  const sampleRows = sampleRowsFromSchema(schema);
  const { getAccessForProduct } = require("../../lib/access-requests");
  const access = getAccessForProduct(req.params.id, req.auth?.sub);
  const dbMatch = manifestYaml.match(/catalogDatabase:\s*(\S+)/);
  const tableMatch = manifestYaml.match(/catalogTable:\s*(\S+)/);
  const database = dbMatch?.[1] || product?.domain || "default";
  const table = tableMatch?.[1] || product?.name || "output";
  let athenaUrl = null;
  try {
    athenaUrl = athenaConsoleUrl({ database, table });
  } catch {
    athenaUrl = null;
  }
  const { productTrust } = require("../../lib/vrp/product-trust");
  const { buildSnapshotPinSql } = require("../../lib/vrp/snapshot-pin");
  const { proofSla } = require("../../lib/vrp/proof-sla");
  const tags = product?.tags || {};
  const icebergSnapshotId = tags.icebergSnapshotId || product?.trust?.icebergSnapshotId || null;
  const lastProofAt = tags.lastProofAt || product?.trust?.lastProofAt || null;
  const trust =
    product?.trust ||
    productTrust({
      proofGated: /pattern:\s*vaquar/.test(manifestYaml) || /qualityPolicyId/.test(manifestYaml),
      vrpVerdict: tags.vrpVerdict || null,
      conformanceProfile: tags.conformanceProfile || null,
      icebergSnapshotId,
      sourceSnapshotId: tags.sourceSnapshotId || null,
      lastProofAt,
    });
  const sla = trust.sla || proofSla({ lastProofAt });
  const vrpPass = trust.vrpVerdict === "PASS" || (trust.badges || []).includes("VRP_PASS");
  const snapshotPin = icebergSnapshotId
    ? buildSnapshotPinSql({ database, table }, icebergSnapshotId)
    : null;
  res.json({
    product: product || { id: req.params.id, name: req.params.id },
    schema,
    sampleRows: vrpPass ? sampleRows : [],
    sampleRowsWithheld: !vrpPass,
    sampleRowsReason: vrpPass
      ? null
      : "Sample rows are withheld until VRP PASS (fail-closed consumer)",
    athenaUrl,
    proofGated: Boolean(trust.proofGated),
    trust,
    sla,
    snapshotPin,
    sourceSnapshotId: trust.sourceSnapshotId,
    conformanceProfile: trust.conformanceProfile,
    gateway: {
      serveEndpoint: "/api/v1/gateway/serve",
      mcpServeEndpoint: "/mcp/gateway/serve",
      requiresGatewayToken: true,
      consumerSnapshotPolicy: "gated_catalog_only",
      verifyEndpoint: "/api/v1/proofs/verify",
      diffEndpoint: "/api/v1/proofs/diff",
    },
    access,
  });
});

app.get("/api/v1/executions/status", requireAuth, async (req, res) => {
  const { getExecutionStatus } = require("../../lib/aws/sfn-execution-status");
  const arn = req.query.arn;
  if (!arn) return res.status(400).json({ status: "error", errors: ["arn query param required"] });
  const status = await getExecutionStatus(arn);
  res.json(status);
});

app.post("/api/v1/pipelines/ai-design", requireAuth, (req, res) => {
  const { designPipelineFromMessage } = require("../../lib/ai-pipeline-designer");
  const { message } = req.body || {};
  const result = designPipelineFromMessage(message);
  res.status(result.success ? 200 : 400).json(result);
});

app.post("/api/v1/agents/ai-design", requireAuth, (req, res) => {
  const { designAgentFromMessage } = require("../../lib/ai-agent-designer");
  const { message } = req.body || {};
  const result = designAgentFromMessage(message);
  res.status(result.success ? 200 : 400).json(result);
});

app.post("/api/v1/pipelines/design-review", requireAuth, (req, res) => {
  const { runDesignReview } = require("../../lib/aws-design-review");
  const { graphToContractSmart } = require("../../lib/contract-builder");
  const { runIntegrityGate } = require("../../lib/integrity-gate");
  const { validateWorkflowGraph, isWorkflowGraph } = require("../../lib/contract-builder/graph-to-workflow");
  const { nodes, edges, pipelineMeta } = req.body || {};
  if (!nodes?.length) {
    return res.status(400).json({
      status: "error",
      errors: ["nodes array is required"],
      fixHint: "Load a pattern or add blocks to the canvas before running AWS Design Review.",
    });
  }

  let contract = null;
  let integrityGate = null;
  let workflowStats = null;
  const graphResult = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
  if (graphResult.success) {
    contract = graphResult.contract;
    integrityGate = runIntegrityGate(contract);
    workflowStats = graphResult.workflowStats;
  } else {
    return res.status(422).json({
      status: "error",
      errors: graphResult.errors || ["Graph could not be compiled to a contract"],
      fixHint: "Fix block validation errors on the canvas, then re-run review.",
      graphErrors: graphResult.errors,
    });
  }
  if (isWorkflowGraph(nodes)) {
    const wf = validateWorkflowGraph(nodes, edges || []);
    workflowStats = { ...workflowStats, ...wf.stats, orphanNodes: wf.orphanNodes };
  }

  const review = runDesignReview({
    nodes,
    edges: edges || [],
    pipelineMeta: pipelineMeta || {},
    contract,
    integrityGate,
    workflowStats,
  });
  res.json({ status: "success", ...review });
});

app.post("/api/v1/pipelines/design-review/fix-help", requireAuth, async (req, res) => {
  const { runDesignReview } = require("../../lib/aws-design-review");
  const { buildFixPlans, enrichFixPlansWithLlm } = require("../../lib/aws-design-review/fix-assistant");
  const { graphToContractSmart } = require("../../lib/contract-builder");
  const { runIntegrityGate } = require("../../lib/integrity-gate");
  const { validateWorkflowGraph, isWorkflowGraph } = require("../../lib/contract-builder/graph-to-workflow");
  const { nodes, edges, pipelineMeta, findingId, findingIds } = req.body || {};

  if (!nodes?.length) {
    return res.status(400).json({ status: "error", errors: ["nodes array is required"] });
  }

  let contract = null;
  let integrityGate = null;
  let workflowStats = null;
  const graphResult = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
  if (graphResult.success) {
    contract = graphResult.contract;
    integrityGate = runIntegrityGate(contract);
    workflowStats = graphResult.workflowStats;
  }
  if (isWorkflowGraph(nodes)) {
    const wf = validateWorkflowGraph(nodes, edges || []);
    workflowStats = { ...workflowStats, ...wf.stats, orphanNodes: wf.orphanNodes };
  }

  const review = runDesignReview({
    nodes,
    edges: edges || [],
    pipelineMeta: pipelineMeta || {},
    contract,
    integrityGate,
    workflowStats,
  });

  const ids = findingId ? [findingId] : findingIds;
  let plans = buildFixPlans({
    findings: review.findings,
    nodes,
    pipelineMeta: pipelineMeta || {},
    findingIds: ids,
  });
  plans = await enrichFixPlansWithLlm(plans, {
    findings: review.findings,
    nodes,
    pipelineMeta: pipelineMeta || {},
  });

  res.json({ status: "success", plans });
});

app.post("/api/v1/pipelines/export/terraform", requireAuth, (req, res) => {
  const { generatePipelineTerraform } = require("../../lib/infrastructure-export");
  const { nodes, pipelineMeta } = req.body || {};
  const result = generatePipelineTerraform({ nodes: nodes || [], pipelineMeta: pipelineMeta || {} });
  res.json({ status: result.status === "success" ? "success" : "empty", ...result });
});

app.post("/api/v1/pipelines/export/drawio", requireAuth, (req, res) => {
  const { generateDrawioArchitecture } = require("../../lib/infrastructure-export");
  const { topology, nodes, pipelineMeta } = req.body || {};
  const result = generateDrawioArchitecture({
    topology,
    nodes: nodes || [],
    pipelineMeta: pipelineMeta || {},
  });
  res.json({ status: "success", ...result });
});

app.post("/api/v1/pipelines/export/spark-declarative", requireAuth, (req, res) => {
  handlePipelineExport(req, res, "sdp");
});

app.post("/api/v1/pipelines/export/dbt", requireAuth, (req, res) => {
  handlePipelineExport(req, res, "dbt");
});

function handlePipelineExport(req, res, kind) {
  const span = startSpan(`api.export.${kind}`, { user_id: req.auth?.sub });
  try {
    const { graphToContractSmart } = require("../../lib/contract-builder");
    const { exportProjectBundle } = require("../../lib/export");
    const { nodes, edges, pipelineMeta, contract: bodyContract } = req.body || {};
    let contract = bodyContract;
    if (!contract && Array.isArray(nodes) && nodes.length) {
      const built = graphToContractSmart(nodes, edges || [], pipelineMeta || {});
      if (!built.success) {
        span.end("error", { code: "EXPORT_GRAPH_INVALID" });
        return res.status(422).json({
          status: "error",
          code: "EXPORT_GRAPH_INVALID",
          errors: built.errors || ["Canvas graph could not be compiled to a DataContract"],
          fixHint:
            "Fix red badges on the canvas (source/transform/sink). Ensure transform SQL is set for SDP/dbt, then retry export.",
          graphErrors: built.errors,
        });
      }
      contract = built.contract;
    }
    if (!contract) {
      span.end("error", { code: "EXPORT_INPUT_REQUIRED" });
      return res.status(400).json({
        status: "error",
        code: "EXPORT_INPUT_REQUIRED",
        errors: ["nodes or contract required"],
        fixHint:
          kind === "dbt"
            ? "Load Architectures → dbt Silver → Gold, then AWS Design Review → Export dbt project."
            : "Load Architectures → Spark Declarative Pipelines (SDP) Medallion, then Export Spark Declarative Pipelines.",
      });
    }
    const result = exportProjectBundle(kind, contract);
    if (result.status !== "success") {
      span.end("error", { code: result.code || "EXPORT_FAILED" });
      return res.status(422).json({
        status: "error",
        code: result.code || "EXPORT_FAILED",
        errors: result.errors || ["Export failed"],
        fixHint: result.fixHint || "See docs/examples/sdp-dbt-export.md",
      });
    }
    span.end("ok", { project: result.projectName, files: String(result.fileCount) });
    res.json(result);
  } catch (err) {
    span.end("error", { error: err.message });
    res.status(500).json({
      status: "error",
      code: "EXPORT_INTERNAL",
      errors: [err.message || "Unexpected export failure"],
      fixHint: "Check GET /health (otel + catalog). API logs include span api.export.* when tracing is on.",
    });
  }
}

app.get("/api/v1/audit", requireAuth, (_req, res) => {
  const { listRecent } = require("../../lib/audit-log");
  res.json({ events: listRecent(100) });
});

app.get("/api/v1/auth/config", (_req, res) => {
  res.json({
    userPoolId: process.env.COGNITO_USER_POOL_ID || "",
    clientId: process.env.COGNITO_CLIENT_ID || "",
    region: process.env.AWS_REGION || "us-east-1",
    authDisabled: process.env.AUTH_DISABLED === "true",
  });
});

app.post("/api/v1/pipelines/preview", requireAuth, (req, res) => {
  const span = startSpan("api.preview", { user_id: req.auth?.sub });
  const { nodes, edges, pipelineMeta } = req.body;
  if (!nodes?.length) {
    span.end("error", { reason: "missing_nodes" });
    return res.status(400).json({ status: "error", errors: ["nodes array is required"] });
  }
  const compileSpan = startSpan("compile.preview", { user_id: req.auth?.sub }, span);
  const result = previewPipeline({ nodes, edges: edges || [], pipelineMeta });
  compileSpan.end(result.status, { contract_id: result.contract?.metadata?.name });
  if (result.status === "success") metrics.inc("preview_success");
  else metrics.inc("preview_failed");
  structuredLog("pipeline_preview", {
    user_id: req.auth?.sub,
    contract_id: result.contract?.metadata?.name,
    outcome: result.status,
    trace_id: span.traceId,
  });
  span.end(result.status, { contract_id: result.contract?.metadata?.name });
  res.status(result.status === "success" ? 200 : 422).json(result);
});

app.post("/api/v1/pipelines/deploy", requireAuth, async (req, res) => {
  const span = startSpan("api.deploy", { user_id: req.auth?.sub });
  const { nodes, edges, pipelineMeta } = req.body;
  if (!nodes?.length) {
    span.end("error", { reason: "missing_nodes" });
    return res.status(400).json({ status: "error", errors: ["nodes array is required"] });
  }

  if (isDeployApprovalRequired() && !req.body?.skipApproval) {
    const pending = queueDeployApproval({
      nodes,
      edges: edges || [],
      pipelineMeta,
      userId: req.auth?.sub,
      userEmail: req.auth?.userEmail || req.auth?.email,
    });
    span.end("pending_approval");
    return res.status(202).json({
      status: "pending_approval",
      message: "Deploy queued for steward approval",
      approval: { id: pending.id, pipelineName: pending.pipelineName, domain: pending.domain },
    });
  }

  const compileSpan = startSpan("compile.deploy", { user_id: req.auth?.sub }, span);
  const result = await deployPipeline({
    nodes,
    edges: edges || [],
    pipelineMeta,
    catalogUrl: CATALOG_URL,
    auth: req.auth,
  });
  compileSpan.end(result.status, {
    contract_id: result.contract?.metadata?.name,
    stage: result.stage,
  });

  if (result.status === "success") {
    metrics.inc("deploy_success");
    if (result.lineage) metrics.inc("lineage_registered");
    savePipelineVersion({
      contract: result.contract,
      manifestYaml: result.manifestYaml,
      nodes,
      edges: edges || [],
      aws: result.aws,
      userEmail: req.auth?.userEmail || req.auth?.email,
    });
  } else {
    metrics.inc("deploy_failed");
    const { notifyPipelineFailure } = require("../../lib/platform/notifications");
    await notifyPipelineFailure({
      pipelineName: result.contract?.metadata?.name || pipelineMeta?.name,
      domain: result.contract?.metadata?.domain || pipelineMeta?.domain,
      errors: result.errors,
      userId: req.auth?.sub,
      stage: result.stage,
    });
  }

  auditRecord({
    action: "pipeline_deploy",
    user_id: req.auth?.sub,
    user_email: req.auth?.userEmail,
    contract_id: result.contract?.metadata?.name,
    domain: result.contract?.metadata?.domain,
    version: result.contract?.metadata?.version,
    outcome: result.status,
    catalog_registered: Boolean(result.catalog?.registered),
    trace_id: span.traceId,
  });

  structuredLog("pipeline_deploy", {
    user_id: req.auth?.sub,
    contract_id: result.contract?.metadata?.name,
    outcome: result.status,
    trace_id: span.traceId,
  });

  span.end(result.status, { contract_id: result.contract?.metadata?.name });
  res.status(result.status === "success" ? 201 : 422).json(result);
});

app.post("/api/v1/platform/deploy-approvals/:id/approve", requireAuth, async (req, res) => {
  const approved = approveDeploy(req.params.id, req.auth?.sub);
  if (!approved.success) {
    return res.status(404).json(approved);
  }
  const { nodes, edges, pipelineMeta } = approved.record;
  const span = startSpan("api.deploy.approved", { user_id: req.auth?.sub });
  const result = await deployPipeline({
    nodes,
    edges: edges || [],
    pipelineMeta,
    catalogUrl: CATALOG_URL,
    auth: req.auth,
  });
  if (result.status === "success") {
    metrics.inc("deploy_success");
    savePipelineVersion({
      contract: result.contract,
      manifestYaml: result.manifestYaml,
      nodes,
      edges: edges || [],
      aws: result.aws,
      userEmail: approved.record.userEmail,
    });
  } else {
    metrics.inc("deploy_failed");
    const { notifyPipelineFailure } = require("../../lib/platform/notifications");
    await notifyPipelineFailure({
      pipelineName: result.contract?.metadata?.name || pipelineMeta?.name,
      domain: result.contract?.metadata?.domain || pipelineMeta?.domain,
      errors: result.errors,
      userId: req.auth?.sub,
      stage: result.stage,
    });
  }
  auditRecord({
    action: "pipeline_deploy_approved",
    user_id: req.auth?.sub,
    contract_id: result.contract?.metadata?.name,
    outcome: result.status,
    approval_id: req.params.id,
  });
  span.end(result.status);
  res.status(result.status === "success" ? 201 : 422).json({ ...result, approvedBy: req.auth?.sub });
});

async function proxyCatalog(req, res, path, method = "GET", body) {
  if (method === "GET" && path.startsWith("/api/v1/products")) {
    const parsed = new URL(path, "http://catalog.local");
    const domain = parsed.searchParams.get("domain") || undefined;
    const idMatch = path.match(/^\/api\/v1\/products\/([^/?]+)/);
    if (idMatch) {
      const result = await getProduct(idMatch[1], req.auth);
      if (result.product) {
        return res.status(200).json(result.product);
      }
      return res.status(404).json({ status: "error", errors: [result.error || "Not found"] });
    }
    const result = await listProducts(domain, req.auth);
    if (result.products) {
      return res.status(200).json(result.products);
    }
    return res.status(502).json({ status: "error", errors: [result.error || "Catalog unavailable"] });
  }

  try {
    const url = `${CATALOG_URL}${path}`;
    const r = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(req.auth?.bearerToken ? { Authorization: `Bearer ${req.auth.bearerToken}` } : {}),
        ...(req.auth?.userEmail ? { "X-CogniMesh-User": req.auth.userEmail } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    res.status(502).json({ status: "error", errors: [err.message] });
  }
}

app.get("/api/v1/products", requireAuth, (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  proxyCatalog(req, res, `/api/v1/products${qs}`);
});

app.get("/api/v1/products/:id", requireAuth, (req, res) => {
  proxyCatalog(req, res, `/api/v1/products/${req.params.id}`);
});

// ---- Public, no-login status dashboard ----
const { PUBLIC_DASHBOARD_HTML } = require("./public-dashboard");

app.get("/api/v1/public/status", async (_req, res) => {
  const region = process.env.AWS_REGION || "us-east-1";
  const pipelines = [];
  const agents = [];
  try {
    const { SFNClient, ListStateMachinesCommand, ListExecutionsCommand } = require("@aws-sdk/client-sfn");
    const sfn = new SFNClient({ region });
    const prefix = process.env.AWS_NAME_PREFIX || "cognimesh-prod";
    const sms = await sfn.send(new ListStateMachinesCommand({ maxResults: 100 }));
    for (const sm of (sms.stateMachines || []).filter((s) => s.name.startsWith(prefix) && !s.name.endsWith("pipeline-orchestrator"))) {
      let lastRun = null;
      try {
        const ex = await sfn.send(new ListExecutionsCommand({ stateMachineArn: sm.stateMachineArn, maxResults: 1 }));
        lastRun = ex.executions?.[0]?.status || null;
      } catch { /* ignore */ }
      pipelines.push({ name: sm.name, created: sm.creationDate, lastRun });
    }
  } catch { /* sfn list unavailable */ }
  try {
    const { BedrockAgentClient, ListAgentsCommand } = require("@aws-sdk/client-bedrock-agent");
    const ba = new BedrockAgentClient({ region });
    const agentRes = await ba.send(new ListAgentsCommand({ maxResults: 100 }));
    for (const a of agentRes.agentSummaries || []) agents.push({ name: a.agentName, id: a.agentId, status: a.agentStatus });
  } catch { /* bedrock list unavailable */ }
  res.json({ status: "ok", region, pipelines, agents, generatedAt: new Date().toISOString() });
});

app.get("/api/v1/public/dashboard", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(PUBLIC_DASHBOARD_HTML);
});

app.get("/api/v1/compute-engines", requireAuth, (_req, res) => {
  const { listEngines } = require("../../lib/contract-builder/compute-engines");
  res.json({ engines: listEngines() });
});

if (require.main === module) {
  process.on("uncaughtException", (err) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: "uncaught_exception", message: err.message, stack: err.stack }));
  });
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: "unhandled_rejection", message }));
  });

  const { bootstrapPlatformStores } = require("../../lib/platform/bootstrap-stores");
  bootstrapPlatformStores()
    .then((info) => {
      structuredLog("platform_store_ready", info);
      app.listen(PORT, () => {
        structuredLog("server_start", { port: PORT, catalog_url: CATALOG_URL });
        console.log(`CogniMesh API Gateway listening on http://localhost:${PORT}`);
        console.log(`  Catalog URL: ${CATALOG_URL}`);
        console.log(`  Auth: ${process.env.AUTH_DISABLED === "true" ? "DISABLED (dev)" : "Cognito JWT"}`);
        if (info.mode === "dynamodb") {
          console.log(`  Platform store: DynamoDB (${info.table})`);
        }
      });
    })
    .catch((err) => {
      console.error("Failed to initialize platform store:", err.message);
      process.exit(1);
    });
}

module.exports = { app };
