import { describe, it, expect } from "vitest";
import { designPipelineFromMessage, matchPatternFromMessage } from "./ai-pipeline-designer";

describe("portal ai-pipeline-designer", () => {
  it("matches data mesh intent locally", () => {
    expect(matchPatternFromMessage("multi domain data mesh customer 360")).toBe("arch-datamesh-multi-domain");
  });

  it("designPipelineFromMessage returns success without API", () => {
    const r = designPipelineFromMessage("Kappa stream only from Kinesis");
    expect(r.success).toBe(true);
    expect(r.patternId).toBe("arch-kappa-stream-only");
  });
});
