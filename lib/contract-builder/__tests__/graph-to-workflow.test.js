#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  compileGraphToStateMachine,
  validateWorkflowGraph,
  isWorkflowGraph,
} = require("../graph-to-workflow");

describe("graph-to-workflow", () => {
  const multiSourceNodes = [
    { id: "start-1", data: { blockType: "start", label: "Start" }, position: { x: 0, y: 0 } },
    { id: "par-1", data: { blockType: "parallel", label: "Parallel" }, position: { x: 0, y: 0 } },
    { id: "src-1", data: { blockType: "source", label: "RDS", sourceType: "rds", database: "db", table: "t" }, position: { x: 0, y: 0 } },
    { id: "src-2", data: { blockType: "source", label: "S3", sourceType: "s3", endpoint: "s3://x/" }, position: { x: 0, y: 0 } },
    { id: "xf-1", data: { blockType: "transform", label: "SQL A", transformType: "spark_sql", sparkSql: "SELECT 1" }, position: { x: 0, y: 0 } },
    { id: "xf-2", data: { blockType: "transform", label: "SQL B", transformType: "spark_sql", sparkSql: "SELECT 2" }, position: { x: 0, y: 0 } },
    { id: "merge-1", data: { blockType: "merge", label: "Merge" }, position: { x: 0, y: 0 } },
    { id: "sink-1", data: { blockType: "sink", label: "Gold", targetType: "iceberg", location: "s3://gold/" }, position: { x: 0, y: 0 } },
  ];
  const multiSourceEdges = [
    { id: "e0", source: "start-1", target: "par-1" },
    { id: "e1", source: "par-1", target: "src-1" },
    { id: "e2", source: "par-1", target: "src-2" },
    { id: "e3", source: "src-1", target: "xf-1" },
    { id: "e4", source: "src-2", target: "xf-2" },
    { id: "e5", source: "xf-1", target: "merge-1" },
    { id: "e6", source: "xf-2", target: "merge-1" },
    { id: "e7", source: "merge-1", target: "sink-1" },
  ];

  it("detects workflow graphs", () => {
    assert.equal(isWorkflowGraph(multiSourceNodes), true);
    assert.equal(
      isWorkflowGraph([
        { id: "s", data: { blockType: "source" } },
        { id: "t", data: { blockType: "transform" } },
        { id: "k", data: { blockType: "sink" } },
      ]),
      false
    );
  });

  it("validates multi-source graph", () => {
    const r = validateWorkflowGraph(multiSourceNodes, multiSourceEdges);
    assert.equal(r.valid, true);
    assert.equal(r.stats.sources, 2);
    assert.equal(r.stats.sinks, 1);
  });

  it("compiles Parallel state machine", () => {
    const r = compileGraphToStateMachine(multiSourceNodes, multiSourceEdges, { name: "test-mesh" });
    assert.equal(r.success, true);
    assert.ok(r.stateMachine.StartAt);
    assert.ok(r.stateMachine.States);
    const parallel = Object.values(r.stateMachine.States).find((s) => s.Type === "Parallel");
    assert.ok(parallel);
    assert.ok(parallel.Branches.length >= 2);
    assert.equal(r.stateMachine.cognimesh.mode, "workflow-graph");
  });

  it("flags parallel with single branch", () => {
    const nodes = [
      { id: "par", data: { blockType: "parallel", label: "P" }, position: {} },
      { id: "src", data: { blockType: "source", label: "S", sourceType: "s3", endpoint: "s3://x/" }, position: {} },
      { id: "sink", data: { blockType: "sink", label: "K", location: "s3://y/" }, position: {} },
    ];
    const edges = [
      { source: "par", target: "src" },
      { source: "src", target: "sink" },
    ];
    const r = validateWorkflowGraph(nodes, edges);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /parallel/i.test(e)));
  });
});
