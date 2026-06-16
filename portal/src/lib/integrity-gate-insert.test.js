import { describe, it, expect } from "vitest";
import { insertIntegrityGate } from "./integrity-gate-insert";

describe("insertIntegrityGate", () => {
  const nodes = [
    { id: "t1", position: { x: 100, y: 100 }, data: { blockType: "transform", label: "SQL" } },
    { id: "s1", position: { x: 300, y: 100 }, data: { blockType: "sink", label: "Gold" } },
  ];
  const edges = [{ id: "e1", source: "t1", target: "s1" }];

  it("inserts gate between transform and sink", () => {
    const result = insertIntegrityGate(nodes, edges, () => "gate-1");
    expect(result.added).toBe(true);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.find((n) => n.id === "gate-1")?.data.blockType).toBe("integrity_gate");
    expect(result.edges.some((e) => e.source === "t1" && e.target === "gate-1")).toBe(true);
    expect(result.edges.some((e) => e.source === "gate-1" && e.target === "s1")).toBe(true);
  });

  it("does not duplicate when gate exists", () => {
    const withGate = [
      ...nodes,
      { id: "g1", position: { x: 200, y: 100 }, data: { blockType: "integrity_gate" } },
    ];
    const result = insertIntegrityGate(withGate, edges, () => "gate-2");
    expect(result.added).toBe(false);
  });
});
