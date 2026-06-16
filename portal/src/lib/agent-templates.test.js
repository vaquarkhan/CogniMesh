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

  it("validates devops and custom starter templates", () => {
    const devops = validateAgentBlocks(
      instantiateAgentTemplate(getAgentTemplateById("devops-sre")).nodes,
      instantiateAgentTemplate(getAgentTemplateById("devops-sre")).edges
    );
    expect(devops.valid).toBe(true);
    expect(devops.summary.guardrailCount).toBeGreaterThanOrEqual(2);

    const custom = validateAgentBlocks(
      instantiateAgentTemplate(getAgentTemplateById("custom-agent-starter")).nodes,
      instantiateAgentTemplate(getAgentTemplateById("custom-agent-starter")).edges
    );
    expect(custom.valid).toBe(true);
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

  it("omits environmentVariables when no guardrails (no empty YAML object)", () => {
    const inst = instantiateAgentTemplate(getAgentTemplateById("blank-agent"));
    const withModel = {
      ...inst,
      nodes: [
        ...inst.nodes,
        {
          id: "model-1",
          type: "agent",
          position: { x: 0, y: 0 },
          data: { label: "Model", blockType: "foundation_model", modelId: "anthropic.claude-3-sonnet" },
        },
      ],
    };
    const { manifest, yaml } = exportAgentManifest({
      nodes: withModel.nodes,
      edges: withModel.edges,
      agentMeta: withModel.agentMeta,
    });
    expect(manifest.spec.environmentVariables).toBeUndefined();
    expect(yaml).not.toMatch(/environmentVariables:\s*$/m);
    expect(yaml).not.toContain("environmentVariables: {}");
  });
});
