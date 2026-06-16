import { describe, it, expect } from "vitest";
import { validateAgentBlocks } from "./validate-agent-blocks";
import { exportAgentManifest } from "./agent-export";
import { AGENT_TEMPLATES, instantiateAgentTemplate, getAgentTemplateById } from "./agent-templates";

describe("agent-templates", () => {
  it("has multiple pre-built templates with guardrails", () => {
    const withGuardrails = AGENT_TEMPLATES.filter((t) =>
      t.nodes.some((n) => n.data?.blockType === "guardrail")
    );
    expect(withGuardrails.length).toBeGreaterThanOrEqual(5);
  });

  it("instantiateAgentTemplate remaps node ids", () => {
    const template = getAgentTemplateById("customer-support");
    const inst = instantiateAgentTemplate(template);
    expect(inst.nodes.length).toBeGreaterThan(0);
    expect(inst.edges.every((e) => inst.nodes.some((n) => n.id === e.source))).toBe(true);
    expect(inst.agentMeta.name).toBe("customer-support-agent");
  });
});

describe("validate-agent-blocks", () => {
  it("requires runtime and model", () => {
    const result = validateAgentBlocks([], []);
    expect(result.valid).toBe(false);

    const blank = instantiateAgentTemplate(getAgentTemplateById("blank-agent"));
    const blankResult = validateAgentBlocks(blank.nodes, blank.edges);
    expect(blankResult.valid).toBe(false);
  });

  it("validates customer support template", () => {
    const inst = instantiateAgentTemplate(getAgentTemplateById("customer-support"));
    const result = validateAgentBlocks(inst.nodes, inst.edges);
    expect(result.valid).toBe(true);
    expect(result.summary.guardrailCount).toBeGreaterThanOrEqual(2);
  });
});

describe("agent-export", () => {
  it("exports AgentCore manifest with guardrail env vars", () => {
    const inst = instantiateAgentTemplate(getAgentTemplateById("fraud-detection"));
    const { manifest, yaml, status } = exportAgentManifest({
      nodes: inst.nodes,
      edges: inst.edges,
      agentMeta: inst.agentMeta,
    });
    expect(status).toBe("success");
    expect(manifest.spec.guardrails.length).toBeGreaterThan(0);
    expect(manifest.spec.environmentVariables.BEDROCK_GUARDRAIL_ID).toBeTruthy();
    expect(yaml).toContain("AgentDeployment");
  });
});
