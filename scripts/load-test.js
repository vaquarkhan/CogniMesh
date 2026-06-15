#!/usr/bin/env node
"use strict";

/**
 * Lightweight load test — concurrent preview requests against local API.
 * Usage: npm run dev:api (terminal 1) && npm run test:load (terminal 2)
 *        API_URL=http://host:4000 CONCURRENCY=50 npm run test:load
 */
require("dotenv").config();

const API = process.env.API_URL || "http://localhost:4000";
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const REQUESTS = Number(process.env.REQUESTS || 50);

const payload = {
  nodes: [
    { id: "s1", data: { blockType: "source", sourceType: "rds", primaryKey: "id", cdcEnabled: true } },
    { id: "t1", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1", schedule: "0 0 * * *" } },
    { id: "k1", data: { blockType: "sink", targetType: "iceberg", location: "s3://x/" } },
  ],
  edges: [
    { source: "s1", target: "t1" },
    { source: "t1", target: "k1" },
  ],
  pipelineMeta: { name: "load-test", domain: "commerce", version: "1.0.0", ownerEmail: "load@test.com" },
};

async function onePreview() {
  const start = Date.now();
  const res = await fetch(`${API}/api/v1/pipelines/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const ms = Date.now() - start;
  const ok = res.ok;
  return { ok, ms, status: res.status };
}

async function run() {
  console.log(`Load test: ${REQUESTS} previews, concurrency ${CONCURRENCY} → ${API}`);

  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) throw new Error(`API unhealthy: ${health.status}`);
  } catch (err) {
    console.error("FAIL: API not reachable. Start with: npm run dev:api");
    console.error(err.message);
    process.exit(1);
  }

  const results = [];
  let index = 0;

  async function worker() {
    while (index < REQUESTS) {
      const i = index++;
      results[i] = await onePreview();
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, REQUESTS) }, () => worker());
  const wallStart = Date.now();
  await Promise.all(workers);
  const wallMs = Date.now() - wallStart;

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] || 0;
  const p95 = times[Math.floor(times.length * 0.95)] || 0;
  const max = times[times.length - 1] || 0;

  console.log(`\nResults: ${ok}/${REQUESTS} OK, ${fail} failed`);
  console.log(`Latency ms — p50: ${p50}, p95: ${p95}, max: ${max}`);
  console.log(`Wall time: ${wallMs}ms (${(REQUESTS / (wallMs / 1000)).toFixed(1)} req/s)`);

  if (fail > 0) {
    console.error("FAIL: some requests failed");
    process.exit(1);
  }
  console.log("\nLoad test passed");
}

run().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
