/**
 * Validate AgentCore agent graph before deploy.
 */

const RUNTIME_TYPES = new Set(["runtime", "supervisor"]);
const MODEL_TYPES = new Set(["foundation_model"]);

export function validateAgentBlocks(nodes, edges) {
  const errors = [];
  const warnings = [];
  const byNode = {};

  if (!nodes.length) {
    return { valid: false, errors: ["Add AgentCore Runtime or load a template."], warnings, byNode };
  }

  const runtimes = nodes.filter((n) => RUNTIME_TYPES.has(n.data?.blockType));
  const models = nodes.filter((n) => n.data?.blockType === "foundation_model");
  const guardrails = nodes.filter((n) => n.data?.blockType === "guardrail");

  if (runtimes.length === 0) {
    errors.push("Agent graph needs an AgentCore Runtime or Supervisor block.");
  }
  if (runtimes.length > 1 && !nodes.some((n) => n.data?.blockType === "supervisor")) {
    warnings.push("Multiple runtime blocks — consider using a Supervisor for multi-agent routing.");
  }
  if (models.length === 0) {
    errors.push("Connect at least one Foundation Model (Bedrock) to the runtime.");
  }
  if (guardrails.length === 0) {
    warnings.push("No Guardrail block — production agents should include content/PII safeguards.");
  }

  const connected = new Set();
  edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  nodes.forEach((n) => {
    const bt = n.data?.blockType;
    if (bt === "foundation_model" && !n.data?.modelId) {
      byNode[n.id] = "Foundation model requires a model ID.";
    }
    if (bt === "guardrail" && !n.data?.guardrailId) {
      byNode[n.id] = "Guardrail requires a guardrail ID.";
    }
    if (bt === "knowledge_base" && !n.data?.kbId) {
      byNode[n.id] = "Knowledge Base requires a KB ID.";
    }
    if (bt === "tool_lambda" && !n.data?.functionName) {
      byNode[n.id] = "Lambda tool requires a function name.";
    }
    if (RUNTIME_TYPES.has(bt)) return;
    if (edges.length > 0 && !connected.has(n.id)) {
      byNode[n.id] = byNode[n.id] || "Block is not connected — wire to Runtime or Gateway.";
    }
  });

  Object.values(byNode).forEach((msg) => {
    if (!errors.includes(msg)) errors.push(msg);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    byNode,
    summary: {
      runtimeCount: runtimes.length,
      modelCount: models.length,
      guardrailCount: guardrails.length,
      toolCount: nodes.filter((n) =>
        ["tool_lambda", "tool_mcp", "tool_api", "code_interpreter", "browser", "gateway"].includes(n.data?.blockType)
      ).length,
    },
  };
}
