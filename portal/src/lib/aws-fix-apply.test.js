import { describe, it, expect } from "vitest";
import { resolveAutoFix, resolvePlanActions } from "./aws-fix-apply";

describe("aws-fix-apply", () => {
  const nodes = [
    { id: "o1", data: { blockType: "sink", location: "s3://lake/gold/" } },
    { id: "s1", data: { blockType: "source", sourceType: "rds", endpoint: "http://db" } },
  ];

  it("applies S3 encryption on sink finding", () => {
    const fix = resolveAutoFix(
      { id: "sec.s3_encryption.o1", nodeIds: ["o1"], title: "Encryption" },
      nodes,
      {}
    );
    expect(fix).toEqual({ type: "node", nodeId: "o1", patch: { encryption: "AES256" } });
  });

  it("applies Lake Formation at pipeline level", () => {
    const fix = resolveAutoFix(
      { id: "sec.lake_formation", nodeIds: ["o1"], title: "LF" },
      nodes,
      {}
    );
    expect(fix).toEqual({ type: "pipelineMeta", patch: { enableLakeFormation: true } });
  });

  it("inserts integrity gate for gate finding", () => {
    const fix = resolveAutoFix({ id: "sec.integrity_gate", title: "Missing Integrity Gate" }, nodes, {});
    expect(fix).toEqual({ type: "add_integrity_gate" });
  });

  it("resolves pipeline meta from API plan", () => {
    const action = resolvePlanActions({
      pipelineMetaPatch: { enableLakeFormation: true },
      nodeId: "o1",
    });
    expect(action).toEqual({ type: "pipelineMeta", patch: { enableLakeFormation: true } });
  });
});
