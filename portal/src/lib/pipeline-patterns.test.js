import { describe, it, expect } from "vitest";
import { PIPELINE_PATTERNS, instantiatePattern, getPatternById } from "./pipeline-patterns";

describe("pipeline-patterns", () => {
  it("includes structured and cognitive patterns", () => {
    expect(PIPELINE_PATTERNS.length).toBeGreaterThan(3);
    expect(getPatternById("vaquar-cdc-orders")).toBeTruthy();
    expect(getPatternById("cognitive-media")).toBeTruthy();
  });

  it("instantiatePattern remaps node ids and edges", () => {
    const pattern = getPatternById("vaquar-cdc-orders");
    const inst = instantiatePattern(pattern);
    expect(inst.nodes).toHaveLength(3);
    expect(inst.edges).toHaveLength(2);
    expect(inst.nodes[0].id).not.toBe("source-1");
    expect(inst.edges[0].source).toBe(inst.nodes[0].id);
    expect(inst.pipelineMeta.name).toBe("customer-orders-cdc");
    expect(inst.tips.length).toBeGreaterThan(0);
  });

  it("blank pattern starts empty", () => {
    const inst = instantiatePattern(getPatternById("blank"));
    expect(inst.nodes).toHaveLength(0);
    expect(inst.edges).toHaveLength(0);
  });
});
