#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { graphToContract, validateGraph, normalizeOwnerContact } = require("../graph-to-contract");
const { previewPipeline } = require("../index");
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

  it("normalizeOwnerContact converts dev username to valid email", () => {
    assert.equal(normalizeOwnerContact("local-dev"), "local-dev@cognimesh.local");
    assert.equal(normalizeOwnerContact("a@b.com"), "a@b.com");
  });

  it("preview succeeds with local-dev ownerEmail (portal auth disabled)", () => {
    const r = previewPipeline({
      nodes: [
        { id: "s1", data: { blockType: "source", sourceType: "rds", database: "db", table: "t", primaryKey: "id", cdcEnabled: true } },
        { id: "t1", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1", schedule: "0 0 * * *", qualityPolicyId: "strict-zero-drop", pvdmContentFields: "id, v" } },
        { id: "k1", data: { blockType: "sink", targetType: "iceberg", location: "s3://x/", catalogDatabase: "g", catalogTable: "t" } },
      ],
      edges,
      pipelineMeta: { name: "unit-test", domain: "commerce", version: "1.0.0", ownerEmail: "local-dev" },
    });
    assert.equal(r.status, "success");
    assert.equal(r.contract.metadata.owner.contact, "local-dev@cognimesh.local");
    assert.equal(r.contract.spec.transform.pvdm.qualityPolicyId, "strict-zero-drop");
  });
});
