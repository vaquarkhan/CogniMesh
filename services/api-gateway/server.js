"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { deployPipeline, previewPipeline } = require("../../lib/contract-builder");
const { requireAuth } = require("./middleware/auth");
const { csrfProtection } = require("./middleware/csrf");
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
const { alertDeployFailure } = require("../../lib/alerting");

const PORT = process.env.PORT || 4000;
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:8080";
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");

const app = express();
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
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
app.use("/api/v1", rateLimit);
app.use("/api/v1", csrfProtection);

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

  const checks = {
    catalog: {
      ok: embedded || catalogUp,
      mode: catalogUp ? "remote" : embedded ? catalogStorageMode() : "unavailable",
    },
    auth: { ok: authDisabled || cognitoConfigured, mode: authDisabled ? "disabled" : cognitoConfigured ? "cognito" : "misconfigured" },
    aws_deploy: { ok: !awsDeploy || awsRole, enabled: awsDeploy },
    lineage_catalog: { ok: true, products: lineageCatalogSummary().totalProducts },
    execution_history: { ok: true, ...executionStats() },
  };

  const ok = Object.values(checks).every((c) => c.ok);
  return { ok, checks };
}

app.get("/health", async (_req, res) => {
  const deep = await deepHealth();
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
    checks: deep.checks,
  });
});

app.get("/metrics", (_req, res) => {
  res.json(
    metrics.snapshot({
      lineage: lineageCatalogSummary(),
      executions: executionStats(),
    })
  );
});

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

app.get("/api/v1/products/:id/consumer-detail", requireAuth, async (req, res) => {
  const { athenaConsoleUrl, parseSchemaFromManifest, sampleRowsFromSchema } = require("../../lib/athena-link");
  let product = null;
  try {
    product = await getProduct(req.params.id, req.auth || {});
  } catch {
    product = null;
  }
  const manifestYaml = product?.manifestYaml || "";
  const schema = parseSchemaFromManifest(manifestYaml);
  const sampleRows = sampleRowsFromSchema(schema);
  const dbMatch = manifestYaml.match(/catalogDatabase:\s*(\S+)/);
  const tableMatch = manifestYaml.match(/catalogTable:\s*(\S+)/);
  const database = dbMatch?.[1] || product?.domain || "default";
  const table = tableMatch?.[1] || product?.name || "output";
  res.json({
    product: product || { id: req.params.id, name: req.params.id },
    schema,
    sampleRows,
    athenaUrl: athenaConsoleUrl({ database, table }),
    proofGated: /pattern:\s*vaquar/.test(manifestYaml) || /qualityPolicyId/.test(manifestYaml),
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
  const compileSpan = startSpan("compile.preview", { trace_parent: span.traceId });
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

  const compileSpan = startSpan("compile.deploy", { trace_parent: span.traceId });
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
  } else {
    metrics.inc("deploy_failed");
    await alertDeployFailure({
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

if (require.main === module) {
  app.listen(PORT, () => {
    structuredLog("server_start", { port: PORT, catalog_url: CATALOG_URL });
    console.log(`CogniMesh API Gateway listening on http://localhost:${PORT}`);
    console.log(`  Catalog URL: ${CATALOG_URL}`);
    console.log(`  Auth: ${process.env.AUTH_DISABLED === "true" ? "DISABLED (dev)" : "Cognito JWT"}`);
  });
}

module.exports = { app };
