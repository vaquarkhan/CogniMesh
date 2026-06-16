#!/usr/bin/env node
"use strict";

/**
 * Wait for Docker Compose services after `docker compose up -d`.
 * Usage: node scripts/docker-smoke-test.js
 */

const CATALOG = process.env.CATALOG_URL || "http://localhost:8080/api/v1/products";
const API = process.env.API_URL || "http://localhost:4000/health";
const PORTAL = process.env.PORTAL_URL || "http://localhost:3000/";

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 180_000);
const INTERVAL_MS = 2000;

async function probe(name, url, validate) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastErr = "";

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const body = await res.text();
      if (validate(res, body)) {
        console.log(`OK  ${name} ${url}`);
        return;
      }
      lastErr = `${name}: HTTP ${res.status}`;
    } catch (err) {
      lastErr = `${name}: ${err.message}`;
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  throw new Error(`Smoke test failed - ${lastErr}`);
}

async function main() {
  await probe("catalog", CATALOG, (res, body) => {
    if (!res.ok) return false;
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  });

  await probe("api", API, (res, body) => {
    if (!res.ok) return false;
    try {
      const j = JSON.parse(body);
      return j.status === "ok" || j.ok === true;
    } catch {
      return false;
    }
  });

  await probe("portal", PORTAL, (res) => res.ok);

  console.log("Docker Compose smoke test passed");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
