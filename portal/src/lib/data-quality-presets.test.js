import { describe, it, expect } from "vitest";
import { QUALITY_POLICIES, SCHEMA_EVOLUTION_POLICIES, qualityPolicyLabel } from "./data-quality-presets";

describe("data-quality-presets", () => {
  it("defines three quality policies", () => {
    expect(QUALITY_POLICIES).toHaveLength(3);
    expect(QUALITY_POLICIES.map((p) => p.id)).toContain("strict-zero-drop");
  });

  it("qualityPolicyLabel resolves known ids", () => {
    expect(qualityPolicyLabel("strict-zero-drop")).toMatch(/Strict/i);
    expect(qualityPolicyLabel("unknown")).toBe("unknown");
  });

  it("schema evolution policies include compatible and strict", () => {
    const ids = SCHEMA_EVOLUTION_POLICIES.map((p) => p.id);
    expect(ids).toContain("compatible");
    expect(ids).toContain("strict");
  });
});
