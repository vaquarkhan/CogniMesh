import { describe, it, expect } from "vitest";
import { SOURCE_TYPES, TRANSFORM_TYPES, TARGET_TYPES } from "./block-types";

describe("block-types", () => {
  it("exports source types used by workflow blocks", () => {
    expect(SOURCE_TYPES).toContain("rds");
    expect(SOURCE_TYPES).toContain("s3");
    expect(SOURCE_TYPES).toContain("kinesis");
  });

  it("exports transform and target types for properties panel", () => {
    expect(TRANSFORM_TYPES.length).toBeGreaterThan(0);
    expect(TARGET_TYPES).toContain("iceberg");
  });
});
