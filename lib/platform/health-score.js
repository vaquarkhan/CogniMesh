"use strict";

const { listRuns } = require("../execution-history");
const { listLineageCatalog } = require("../lineage-catalog");
const { listPending } = require("../access-requests");

function computeHealthScore({ domain, name } = {}) {
  const runs = listRuns({ pipelineName: name, domain, limit: 20 });
  const graphs = listLineageCatalog(domain);
  const product = name
    ? graphs.find((g) => g.productName === name || g.metadata?.name === name)
    : null;

  const successRate = runs.length
    ? runs.filter((r) => r.outcome === "success").length / runs.length
    : 0.5;
  const vrpPass = runs.length
    ? runs.filter((r) => r.vrpVerdict === "PASS" || r.outcome === "success").length / runs.length
    : 0.5;
  const freshnessHours = runs[0]?.ts
    ? (Date.now() - new Date(runs[0].ts).getTime()) / 3600000
    : 48;
  const freshnessScore = Math.max(0, 1 - freshnessHours / 72);
  const consumerScore = product?.consumers?.length ? Math.min(1, product.consumers.length / 5) : 0.3;
  const schemaStability = product?.schemaEvolution?.allowed !== false ? 1 : 0.4;

  const weighted =
    successRate * 30 +
    vrpPass * 25 +
    freshnessScore * 20 +
    consumerScore * 15 +
    schemaStability * 10;

  const score = Math.round(Math.min(100, Math.max(0, weighted)));

  return {
    score,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D",
    factors: {
      successRate: Math.round(successRate * 100),
      vrpPassRate: Math.round(vrpPass * 100),
      freshnessHours: Math.round(freshnessHours * 10) / 10,
      consumerCount: product?.consumers?.length || 0,
      schemaStable: schemaStability >= 0.9,
    },
    pendingAccessRequests: listPending().length,
  };
}

function listProductHealthScores(domain) {
  const graphs = listLineageCatalog(domain);
  const seen = new Set();
  const products = [];
  for (const g of graphs) {
    const name = g.name;
    const dom = g.domain || domain;
    const key = `${dom}/${name}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    products.push({
      domain: dom,
      name,
      productId: g.productId,
      health: computeHealthScore({ domain: dom, name }),
    });
  }
  products.sort((a, b) => b.health.score - a.health.score);
  return products;
}

module.exports = { computeHealthScore, listProductHealthScores };
