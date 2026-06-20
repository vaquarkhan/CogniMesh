import { describe, it, expect } from "vitest";
import { buildClientFixPlan, mergeWizardFindings } from "./client-fix-plan";

describe("client-fix-plan", () => {
  it("builds S3 encryption patch without API", () => {
    const finding = {
      id: "setup.s3_encryption.sink-1",
      severity: "medium",
      title: "Encryption",
      message: "Enable encryption",
      nodeIds: ["sink-1"],
    };
    const nodes = [{ id: "sink-1", data: { blockType: "sink" } }];
    const plan = buildClientFixPlan(finding, nodes, { domain: "gold" });
    expect(plan.propertyPatch).toEqual({ encryption: "AES256" });
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("merges deploy errors with AWS findings", () => {
    const merged = mergeWizardFindings({
      deployErrors: ["RDS secret ARN required"],
      awsFindings: [
        { id: "sec.lake_formation", severity: "high", title: "LF", message: "Enable LF" },
      ],
    });
    expect(merged.some((f) => f.message.includes("RDS secret"))).toBe(true);
    expect(merged.some((f) => f.id === "sec.lake_formation")).toBe(true);
  });
});
