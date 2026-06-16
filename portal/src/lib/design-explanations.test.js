import { describe, it, expect } from "vitest";
import { buildAgentCreationPlan, buildPipelineCreationPlan } from "./design-explanations";
import { getAgentTemplateById } from "./agent-templates";
import { getPatternById } from "./pipeline-patterns";
import { defaultAgentFeatures } from "./agent-feature-options";

describe("design-explanations", () => {
  it("buildPipelineCreationPlan explains data mesh pattern", () => {
    const pattern = getPatternById("arch-datamesh-multi-domain");
    const plan = buildPipelineCreationPlan(pattern);
    expect(plan.title).toContain("Multi-Domain");
    expect(plan.whatWeCreate.length).toBeGreaterThan(40);
    expect(plan.howItWorks.length).toBeGreaterThan(2);
    expect(plan.flow).toBeTruthy();
  });

  it("buildAgentCreationPlan explains support agent with features", () => {
    const template = getAgentTemplateById("customer-support");
    const plan = buildAgentCreationPlan(template, defaultAgentFeatures());
    expect(plan.title).toContain("Customer Support");
    expect(plan.whatWeCreate).toMatch(/Knowledge Base|support/i);
    expect(plan.howItWorks.some((s) => /Guardrail/i.test(s))).toBe(true);
    expect(plan.features).toContain("Guardrails");
  });
});
