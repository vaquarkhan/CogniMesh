#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { graphToContract, validateGraph } = require("../graph-to-contract");
const { validateContract } = require("../validate");

const nodes = [
  { id: "s1", data: { blockType: "source", sourceType: "rds", primaryKey: "id", cdcEnabled: true } },
  { id: "t1", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1" } },
  { id: "k1", data: { blockType: "sink", targetType: "iceberg", location: "s3://x/" } },
];
const edges = [
  { source: "s1", target: "t1" },
  { source: "t1", target: "k1" },
];

describe("contract-builder", () => {
  it("validates graph topology", () => {
    const r = validateGraph(nodes, edges);
    assert.equal(r.valid, true);
  });

  it("graphToContract sets vaquar pattern for spark_sql", () => {
    const { success, contract } = graphToContract(nodes, edges, {
      name: "unit-test",
      domain: "commerce",
      version: "1.0.0",
      ownerEmail: "a@b.com",
    });
    assert.equal(success, true);
    assert.equal(contract.spec.execution.pattern, "vaquar");
    assert.ok(contract.spec.transform.pvdm);
  });

  it("validateContract accepts generated contract", () => {
    const { contract } = graphToContract(nodes, edges, {
      name: "unit-test",
      domain: "commerce",
      version: "1.0.0",
      ownerEmail: "a@b.com",
    });
    const v = validateContract(contract);
    assert.equal(v.valid, true, JSON.stringify(v.errors));
  });
});
