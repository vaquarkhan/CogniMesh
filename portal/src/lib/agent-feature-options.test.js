import { describe, it, expect } from "vitest";
import {
  applyAgentFeatures,
  defaultAgentFeatures,
  inferAgentFeaturesFromMessage,
} from "./agent-feature-options";
import { getAgentTemplateById, instantiateAgentTemplate } from "./agent-templates";

describe("agent-feature-options", () => {
  it("defaultAgentFeatures enables guardrails and session memory", () => {
    const f = defaultAgentFeatures();
    expect(f.guardrails).toBe(true);
    expect(f.memorySession).toBe(true);
    expect(f.memoryLong).toBe(false);
  });

  it("inferAgentFeaturesFromMessage detects HITL and KB from prompt", () => {
    const f = inferAgentFeaturesFromMessage(
      "Fraud investigation agent with human-in-the-loop and knowledge base"
    );
    expect(f.humanLoop).toBe(true);
    expect(f.knowledgeBase).toBe(true);
  });

  it("applyAgentFeatures removes guardrails when unchecked", () => {
    const template = getAgentTemplateById("customer-support");
    const base = instantiateAgentTemplate(template);
    const before = base.nodes.filter((n) => n.data.blockType === "guardrail").length;
    expect(before).toBeGreaterThan(0);

    const result = applyAgentFeatures(base, { ...defaultAgentFeatures(), guardrails: false });
    const after = result.nodes.filter((n) => n.data.blockType === "guardrail").length;
    expect(after).toBe(0);
    expect(result.agentMeta.features.guardrails).toBe(false);
  });

  it("applyAgentFeatures adds session memory when enabled on blank agent", () => {
    const template = getAgentTemplateById("blank-agent");
    const base = instantiateAgentTemplate(template);
    const result = applyAgentFeatures(base, { ...defaultAgentFeatures(), memorySession: true });
    expect(result.nodes.some((n) => n.data.blockType === "memory_session")).toBe(true);
  });
});
