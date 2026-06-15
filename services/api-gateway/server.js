"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { deployPipeline, previewPipeline } = require("../../lib/contract-builder");
const { requireAuth } = require("./middleware/auth");

const PORT = process.env.PORT || 4000;
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:8080";
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");

const app = express();
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CogniMesh-User"],
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cognimesh-api-gateway",
    auth: process.env.AUTH_DISABLED === "true" ? "disabled" : "cognito",
  });
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
  const { nodes, edges, pipelineMeta } = req.body;
  if (!nodes?.length) {
    return res.status(400).json({ status: "error", errors: ["nodes array is required"] });
  }
  const result = previewPipeline({ nodes, edges: edges || [], pipelineMeta });
  res.status(result.status === "success" ? 200 : 422).json(result);
});

app.post("/api/v1/pipelines/deploy", requireAuth, async (req, res) => {
  const { nodes, edges, pipelineMeta } = req.body;
  if (!nodes?.length) {
    return res.status(400).json({ status: "error", errors: ["nodes array is required"] });
  }

  const result = await deployPipeline({
    nodes,
    edges: edges || [],
    pipelineMeta,
    catalogUrl: CATALOG_URL,
    auth: req.auth,
  });

  res.status(result.status === "success" ? 201 : 422).json(result);
});

async function proxyCatalog(req, res, path, method = "GET", body) {
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

app.listen(PORT, () => {
  console.log(`CogniMesh API Gateway listening on http://localhost:${PORT}`);
  console.log(`  Catalog URL: ${CATALOG_URL}`);
  console.log(`  Auth: ${process.env.AUTH_DISABLED === "true" ? "DISABLED (dev)" : "Cognito JWT"}`);
});
