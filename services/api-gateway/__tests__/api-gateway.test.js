#!/usr/bin/env node
"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.AUTH_DISABLED = "true";
process.env.CSRF_DISABLED = "true";
process.env.CATALOG_FALLBACK = "embedded";
process.env.CATALOG_STORAGE = "memory";

const { app } = require("../server");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe("api-gateway", () => {
  let base;
  let server;

  before(async () => {
    const ctx = await listen();
    base = ctx.base;
    server = ctx.server;
  });

  after(() => {
    server?.close();
  });

  it("GET /health returns checks", async () => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "ok");
    assert.ok(body.checks.catalog);
    assert.ok(body.checks.lineage_catalog);
  });

  it("GET /metrics returns counters", async () => {
    const res = await fetch(`${base}/metrics`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.counters);
  });

  it("POST /api/v1/pipelines/preview compiles contract with lineage", async () => {
    const res = await fetch(`${base}/api/v1/pipelines/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: [
          { id: "s1", data: { blockType: "source", sourceType: "rds", primaryKey: "id", cdcEnabled: true } },
          { id: "t1", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1", schedule: "0 0 * * *" } },
          { id: "k1", data: { blockType: "sink", targetType: "iceberg", location: "s3://x/" } },
        ],
        edges: [
          { source: "s1", target: "t1" },
          { source: "t1", target: "k1" },
        ],
        pipelineMeta: { name: "api-unit-test", domain: "commerce", version: "1.0.0", ownerEmail: "t@t.com" },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "success");
    assert.ok(body.lineage?.nodes?.length > 0);
  });

  it("GET /api/v1/lineage/catalog returns summary", async () => {
    const res = await fetch(`${base}/api/v1/lineage/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.graphs));
  });
});
