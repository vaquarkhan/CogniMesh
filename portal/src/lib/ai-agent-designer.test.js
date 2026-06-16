import { describe, it, expect } from "vitest";
import { designAgentFromMessage, matchAgentTemplateFromMessage } from "./ai-agent-designer";

describe("ai-agent-designer", () => {
  it("matches support agent intent", () => {
    expect(matchAgentTemplateFromMessage("customer support with FAQ")).toBe("customer-support");
  });

  it("matches devops SRE intent", () => {
    expect(matchAgentTemplateFromMessage("devops on-call runbook cloudwatch")).toBe("devops-sre");
  });

  it("matches custom agent starter", () => {
    expect(matchAgentTemplateFromMessage("build my own custom agent with tools")).toBe("custom-agent-starter");
  });

  it("designAgentFromMessage works without API", () => {
    const r = designAgentFromMessage("fraud investigation with human review");
    expect(r.success).toBe(true);
    expect(r.templateId).toBe("fraud-detection");
  });

  it("defaults to custom-agent-starter when no match", () => {
    const r = designAgentFromMessage("something completely unrelated xyz");
    expect(r.templateId).toBe("custom-agent-starter");
  });
});
