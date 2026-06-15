#!/usr/bin/env node
"use strict";

/**
 * HTTP E2E: health -> preview -> deploy -> marketplace list
 * Requires API on :4000 and catalog on :8080
 */
require("dotenv").config();

const API = process.env.API_URL || "http://localhost:4000";

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

async function run() {
  console.log("1. Health");
  const health = await fetch(`${API}/health`).then((r) => r.json());
  if (health.status !== "ok") throw new Error("API unhealthy");
  console.log("   ok");

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
  console.log(`   catalog: ${deploy.catalog?.registered ? "registered" : "offline"}`);
  console.log(`   aws: ${deploy.aws?.deployed ? "deployed" : "local"}`);

  console.log("4. Marketplace");
  const products = await fetch(`${API}/api/v1/products`).then((r) => r.json());
  if (!Array.isArray(products)) throw new Error("Products list failed");
  console.log(`   ${products.length} product(s)`);

  console.log("\nAPI E2E passed");
}

run().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
