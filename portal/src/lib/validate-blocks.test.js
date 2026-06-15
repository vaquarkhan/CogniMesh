import { describe, it, expect } from "vitest";
import { validateBlocks } from "./validate-blocks";

describe("validateBlocks", () => {
  const validNodes = [
    { id: "s", data: { blockType: "source", sourceType: "rds", database: "db", table: "t" } },
    { id: "t", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1" } },
    { id: "k", data: { blockType: "sink", targetType: "iceberg", location: "s3://x/" } },
  ];
  const validEdges = [
    { source: "s", target: "t" },
    { source: "t", target: "k" },
  ];

  it("passes valid pipeline graph", () => {
    const r = validateBlocks(validNodes, validEdges);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("flags missing sink location", () => {
    const nodes = validNodes.map((n) =>
      n.id === "k" ? { ...n, data: { ...n.data, location: "" } } : n
    );
    const r = validateBlocks(nodes, validEdges);
    expect(r.valid).toBe(false);
    expect(r.byNode.k).toBeTruthy();
  });

  it("flags disconnected source", () => {
    const r = validateBlocks(validNodes, [{ source: "t", target: "k" }]);
    expect(r.valid).toBe(false);
    expect(r.byNode.s).toMatch(/connect/i);
  });

  it("validates multi-source workflow graph", () => {
    const nodes = [
      { id: "start", data: { blockType: "start", label: "Start" } },
      { id: "par", data: { blockType: "parallel", label: "Parallel" } },
      { id: "s1", data: { blockType: "source", sourceType: "rds", database: "db", table: "a", label: "RDS" } },
      { id: "s2", data: { blockType: "source", sourceType: "s3", endpoint: "s3://x/", label: "S3" } },
      { id: "t1", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 1", label: "T1" } },
      { id: "t2", data: { blockType: "transform", transformType: "spark_sql", sparkSql: "SELECT 2", label: "T2" } },
      { id: "m", data: { blockType: "merge", label: "Merge" } },
      { id: "k", data: { blockType: "sink", targetType: "iceberg", location: "s3://gold/", label: "Gold" } },
    ];
    const edges = [
      { source: "start", target: "par" },
      { source: "par", target: "s1" },
      { source: "par", target: "s2" },
      { source: "s1", target: "t1" },
      { source: "s2", target: "t2" },
      { source: "t1", target: "m" },
      { source: "t2", target: "m" },
      { source: "m", target: "k" },
    ];
    const r = validateBlocks(nodes, edges);
    expect(r.valid).toBe(true);
    expect(r.stats?.sources).toBe(2);
  });
});
