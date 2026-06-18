import { describe, it, expect } from "vitest";
import {
  normalizeNodeData,
  resolveRdsMode,
  rdsWizardSteps,
  PROVISION,
  EXISTING,
} from "./resource-provisioning";

describe("resource-provisioning", () => {
  it("defaults RDS to create (provision)", () => {
    const data = normalizeNodeData({ blockType: "source", sourceType: "rds" });
    expect(data.rdsProvisioningMode).toBe(PROVISION);
    expect(resolveRdsMode(data)).toBe(PROVISION);
  });

  it("existing mode requires secret step", () => {
    const steps = rdsWizardSteps({
      sourceType: "rds",
      rdsProvisioningMode: EXISTING,
      database: "db",
      table: "t",
    });
    expect(steps.some((s) => s.id === "credentials" && !s.complete)).toBe(true);
  });

  it("provision mode skips ARN steps", () => {
    const steps = rdsWizardSteps({
      sourceType: "rds",
      rdsProvisioningMode: PROVISION,
      database: "db",
      table: "t",
    });
    expect(steps.some((s) => s.id === "credentials")).toBe(false);
    expect(steps.every((s) => s.complete || s.id === "mode")).toBe(true);
  });
});
