#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildLineageGraph, saveLineage, getLineage, lineageCatalogSummary } = require("../lineage-catalog");
const { evaluateSchemaEvolution, diffSchemas } = require("../schema-evolution");

const sampleContract = {
  metadata: { name: "orders", domain: "commerce", version: "1.0.0" },
  spec: {
    execution: { pattern: "vaquar", mode: "batch" },
    source: {
      type: "rds",
      schema: [
        { name: "order_id", type: "string" },
        { name: "amount", type: "decimal" },
      ],
    },
    transform: { type: "spark_sql", layers: ["bronze", "silver", "gold"] },
    target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "orders" } },
    schemaEvolution: { policy: "compatible" },
  },
};

describe("lineage-catalog", () => {
  it("builds medallion graph with consumers", () => {
    const g = buildLineageGraph(sampleContract);
    assert.ok(g.nodes.find((n) => n.id === "source"));
    assert.ok(g.nodes.find((n) => n.id === "consumers"));
    assert.ok(g.edges.length >= 4);
  });

  it("saves and retrieves lineage by product id", () => {
    saveLineage("prod-1", sampleContract);
    const g = getLineage("prod-1");
    assert.equal(g.productKey, "commerce/orders");
  });

  it("summarizes lineage catalog", () => {
    const s = lineageCatalogSummary();
    assert.ok(s.totalProducts >= 1);
  });
});

describe("schema-evolution", () => {
  it("diffs added columns", () => {
    const d = diffSchemas(
      [{ name: "a", type: "string" }],
      [{ name: "a", type: "string" }, { name: "b", type: "int" }]
    );
    assert.deepEqual(d.added, ["b"]);
  });

  it("compatible policy allows new columns", () => {
    const prev = { spec: { source: { schema: [{ name: "a", type: "string" }] } } };
    const next = {
      spec: {
        source: { schema: [{ name: "a", type: "string" }, { name: "b", type: "int" }] },
        schemaEvolution: { policy: "compatible" },
      },
    };
    const r = evaluateSchemaEvolution(prev, next);
    assert.equal(r.allowed, true);
  });

  it("strict policy rejects new columns", () => {
    const prev = { spec: { source: { schema: [{ name: "a", type: "string" }] } } };
    const next = {
      spec: {
        source: { schema: [{ name: "a", type: "string" }, { name: "b", type: "int" }] },
        schemaEvolution: { policy: "strict" },
      },
    };
    const r = evaluateSchemaEvolution(prev, next);
    assert.equal(r.allowed, false);
  });
});
