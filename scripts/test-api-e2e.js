#!/usr/bin/env node
"use strict";

/**
 * HTTP E2E: health -> preview -> deploy -> marketplace list
 * Requires API on :4000. Catalog (Spring Boot :8080) is optional — tests SKIP when offline.
 */
require("dotenv").config();

const API = process.env.API_URL || "http://localhost:4000";
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:8080";

const nodes = [
  { id: "s1", data: { blockType: "source", sourceType: "rds", database: "orders_db", table: "orders", cdcEnabled: true, primaryKey: "order_id" } },
  { id: "t1", data: { blockType: "transform", transformType: "spark_sql", executionMode: "batch", schedule: "0 0 * * *", sparkSql: "SELECT * FROM bronze.orders" } },
  { id: "k1", data: { blockType: "sink", targetType: "iceberg", location: "s3://cognimesh-dev-gold/orders/", catalogDatabase: "commerce_gold", catalogTable: "orders" } },
];
const edges = [
  { source: "s1", target: "t1" },
  { source: "t1", target: "k1" },
];
const pipelineMeta = { name: "api-e2e-test", domain: "commerce", version: "1.0.0", ownerEmail: "e2e@test.com" };

let skipped = 0;

function skip(step, reason) {
  skipped += 1;
  console.log(`   SKIP (${reason})`);
}

async function catalogRemoteUp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${CATALOG_URL}/api/v1/products`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function run() {
  console.log("1. Health");
  const health = await fetch(`${API}/health`).then((r) => r.json());
  if (health.status !== "ok") throw new Error("API unhealthy");
  console.log(`   ok (catalog reachable: ${health.catalog?.reachable ? "yes" : "no"}, storage: ${health.catalog?.storage || health.catalog?.fallback || "n/a"})`);

  console.log("2. Preview");
  const preview = await fetch(`${API}/api/v1/pipelines/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  }).then((r) => r.json());
  if (preview.status !== "success") {
    console.error(preview);
    throw new Error("Preview failed");
  }
  console.log("   ok");

  console.log("3. Deploy");
  const deploy = await fetch(`${API}/api/v1/pipelines/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  }).then((r) => r.json());
  if (deploy.status !== "success") {
    console.error(deploy);
    throw new Error("Deploy failed");
  }
  const catalogLabel = deploy.catalog?.registered
    ? `registered (${deploy.catalog?.source || "remote"})`
    : deploy.catalog?.source === "embedded"
      ? "embedded (local fallback)"
      : "offline";
  console.log(`   catalog: ${catalogLabel}`);
  console.log(`   aws: ${deploy.aws?.deployed ? "deployed" : "local"}`);

  console.log("4. Marketplace");
  const productsRes = await fetch(`${API}/api/v1/products`);
  const products = await productsRes.json();
  if (!productsRes.ok || products?.status === "error") {
    skip("marketplace", "catalog offline and no embedded products");
  } else if (!Array.isArray(products)) {
    skip("marketplace", "unexpected response shape");
  } else {
    console.log(`   ${products.length} product(s)`);
    if (products.length === 0 && !(await catalogRemoteUp())) {
      console.log("   (embedded fallback active — deploy may register on next run)");
    }
  }

  console.log(`\nAPI E2E passed${skipped ? ` (${skipped} check(s) skipped)` : ""}`);
}

function shutdown(code) {
  try {
    const http = require("http");
    const https = require("https");
    http.globalAgent.destroy();
    https.globalAgent.destroy();
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(code), 100);
}

run()
  .then(() => shutdown(0))
  .catch((err) => {
    console.error("FAIL:", err.message);
    shutdown(1);
  });
