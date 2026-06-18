import { describe, it, expect } from "vitest";
import { PIPELINE_PATTERNS, instantiatePattern, getPatternById } from "./pipeline-patterns";

describe("pipeline-patterns", () => {
  it("includes structured and cognitive patterns", () => {
    expect(PIPELINE_PATTERNS.length).toBeGreaterThan(25);
    expect(getPatternById("vaquar-cdc-orders")).toBeTruthy();
    expect(getPatternById("cognitive-media")).toBeTruthy();
    expect(getPatternById("medallion-full-stack")).toBeTruthy();
    expect(getPatternById("arch-datamesh-domain-product")).toBeTruthy();
    expect(getPatternById("arch-kappa-stream-only")).toBeTruthy();
    expect(getPatternById("arch-lambda-batch-speed")).toBeTruthy();
    expect(getPatternById("arch-glue-etl-factory")).toBeTruthy();
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

  it("all library patterns default create (provision) for RDS, S3, and sinks", () => {
    for (const pattern of PIPELINE_PATTERNS) {
      const inst = instantiatePattern(pattern);
      for (const n of inst.nodes) {
        const d = n.data || {};
        if (d.blockType === "source" && (d.sourceType === "rds" || d.sourceType === "mysql")) {
          expect(d.rdsProvisioningMode, `${pattern.id} RDS`).toBe("provision");
        }
        if (d.blockType === "source" && d.sourceType === "s3") {
          expect(d.sourceProvisioningMode, `${pattern.id} S3 source`).toBe("provision");
        }
        if (d.blockType === "sink" && (d.targetType === "s3" || d.targetType === "iceberg")) {
          expect(d.sinkProvisioningMode, `${pattern.id} sink`).toBe("provision");
        }
      }
    }
  });
});
