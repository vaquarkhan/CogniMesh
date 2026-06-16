import { describe, it, expect } from "vitest";
import {
  AGENT_FEATURES,
  applyAgentFeatures,
  defaultAgentFeatures,
  inferAgentFeaturesFromMessage,
} from "./agent-feature-options";
import { AGENT_BLOCKS } from "./agent-blocks";
import { getAgentTemplateById, instantiateAgentTemplate } from "./agent-templates";

describe("agent-feature-options", () => {
  it("defaultAgentFeatures enables guardrails and session memory", () => {
    const f = defaultAgentFeatures();
    expect(f.guardrails).toBe(true);
    expect(f.memorySession).toBe(true);
    expect(f.memoryLong).toBe(false);
  });

  it("exposes all Bedrock AgentCore feature toggles", () => {
    expect(AGENT_FEATURES.map((f) => f.id)).toEqual([
      "guardrails",
      "memorySession",
      "memoryLong",
      "knowledgeBase",
      "gateway",
      "codeInterpreter",
      "browser",
      "identity",
      "observability",
      "humanLoop",
    ]);
  });

  it("palette includes both content and PII guardrail blocks", () => {
    const guardrails = AGENT_BLOCKS.filter((b) => b.defaults.blockType === "guardrail");
    expect(guardrails.length).toBeGreaterThanOrEqual(2);
    expect(guardrails.some((b) => b.type === "guardrail-standard")).toBe(true);
    expect(guardrails.some((b) => b.type === "guardrail-pii")).toBe(true);
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

  it("customer-support template ships multiple guardrail blocks when enabled", () => {
    const template = getAgentTemplateById("customer-support");
    const base = instantiateAgentTemplate(template, defaultAgentFeatures());
    const guardrails = base.nodes.filter((n) => n.data.blockType === "guardrail");
    expect(guardrails.length).toBeGreaterThanOrEqual(2);
    expect(guardrails.some((n) => n.data.piiAction)).toBe(true);
    expect(guardrails.some((n) => (n.data.deniedTopics || []).length > 0)).toBe(true);
  });

  it("applyAgentFeatures adds session memory when enabled on blank agent", () => {
    const template = getAgentTemplateById("blank-agent");
    const base = instantiateAgentTemplate(template);
    const result = applyAgentFeatures(base, { ...defaultAgentFeatures(), memorySession: true });
    expect(result.nodes.some((n) => n.data.blockType === "memory_session")).toBe(true);
  });

  it("applyAgentFeatures can enable every optional Bedrock feature on blank agent", () => {
    const template = getAgentTemplateById("blank-agent");
    const base = instantiateAgentTemplate(template);
    const allOn = defaultAgentFeatures(
      Object.fromEntries(AGENT_FEATURES.map((f) => [f.id, true]))
    );
    const result = applyAgentFeatures(base, allOn);
    for (const feat of AGENT_FEATURES) {
      if (feat.id === "gateway") {
        expect(result.nodes.some((n) => n.data.blockType === "gateway")).toBe(true);
        continue;
      }
      expect(
        result.nodes.some((n) => feat.blockTypes.includes(n.data.blockType)),
        `missing block for ${feat.id}`
      ).toBe(true);
    }
  });
});
