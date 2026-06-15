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
});
