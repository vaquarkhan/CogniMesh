/**
 * Export AgentCore deployment manifest from agent canvas graph.
 */

function collectByType(nodes, blockType) {
  return nodes.filter((n) => n.data?.blockType === blockType);
}

function guardrailSpec(node) {
  const d = node.data;
  return {
    id: d.guardrailId,
    version: d.version || "1",
    piiAction: d.piiAction,
    piiEntities: d.piiEntities,
    contentFilters: d.contentFilters,
    deniedTopics: d.deniedTopics,
  };
}

function toolSpec(node) {
  const d = node.data;
  const base = { label: d.label, blockType: d.blockType };
  switch (d.blockType) {
    case "tool_lambda":
      return { ...base, functionName: d.functionName, description: d.description };
    case "tool_mcp":
      return { ...base, serverUrl: d.serverUrl, tools: d.tools };
    case "tool_api":
      return { ...base, openApiSpec: d.openApiSpec, authType: d.authType };
    case "code_interpreter":
      return { ...base, languages: d.languages, sandbox: d.sandbox };
    case "browser":
      return { ...base, allowedDomains: d.allowedDomains, headless: d.headless };
    case "gateway":
      return { ...base, authMode: d.authMode, protocols: d.protocols };
    default:
      return base;
  }
}

export function exportAgentManifest({ nodes, edges, agentMeta }) {
  const runtime = nodes.find((n) => n.data?.blockType === "runtime")
    || nodes.find((n) => n.data?.blockType === "supervisor");
  const models = collectByType(nodes, "foundation_model");
  const guardrails = collectByType(nodes, "guardrail");
  const knowledgeBases = collectByType(nodes, "knowledge_base");
  const memory = nodes.filter((n) => ["memory_session", "memory_long"].includes(n.data?.blockType));
  const tools = nodes.filter((n) =>
    ["tool_lambda", "tool_mcp", "tool_api", "code_interpreter", "browser", "gateway"].includes(n.data?.blockType)
  );
  const identity = collectByType(nodes, "identity");
  const observability = collectByType(nodes, "observability");
  const humanLoop = collectByType(nodes, "human_loop");

  const manifest = {
    apiVersion: "agentcore.cognimesh/v1",
    kind: "AgentDeployment",
    metadata: {
      name: agentMeta.name,
      domain: agentMeta.domain,
      version: agentMeta.version,
      description: agentMeta.description || "",
    },
    spec: {
      runtime: runtime
        ? {
            label: runtime.data.label,
            framework: runtime.data.framework || "strands",
            sessionIsolation: runtime.data.sessionIsolation !== false,
            maxDurationHours: runtime.data.maxDurationHours || 8,
            supervisor: runtime.data.blockType === "supervisor"
              ? { subAgentCount: runtime.data.subAgentCount, routingStrategy: runtime.data.routingStrategy }
              : undefined,
          }
        : null,
      foundationModels: models.map((n) => ({
        modelId: n.data.modelId,
        temperature: n.data.temperature,
        maxTokens: n.data.maxTokens,
      })),
      guardrails: guardrails.map(guardrailSpec),
      knowledgeBases: knowledgeBases.map((n) => ({
        kbId: n.data.kbId,
        embeddingModel: n.data.embeddingModel,
        retrievalMode: n.data.retrievalMode,
      })),
      memory: memory.map((n) => ({
        type: n.data.blockType === "memory_session" ? "session" : "long_term",
        ttlMinutes: n.data.ttlMinutes,
        retentionDays: n.data.retentionDays,
        extractionMode: n.data.extractionMode,
      })),
      tools: tools.map(toolSpec),
      identity: identity.map((n) => ({
        authProvider: n.data.authProvider,
        scopePolicy: n.data.scopePolicy,
      })),
      observability: observability.map((n) => ({
        traces: n.data.traces,
        cloudWatch: n.data.cloudWatch,
        xray: n.data.xray,
      })),
      humanInTheLoop: humanLoop.map((n) => ({
        approvalThreshold: n.data.approvalThreshold,
        timeoutMinutes: n.data.timeoutMinutes,
      })),
      topology: {
        nodes: nodes.map((n) => ({ id: n.id, blockType: n.data.blockType, label: n.data.label })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
      },
      environmentVariables: guardrails.length
        ? {
            BEDROCK_GUARDRAIL_ID: guardrails[0].data.guardrailId,
            BEDROCK_GUARDRAIL_VERSION: guardrails[0].data.version || "1",
          }
        : {},
    },
  };

  const yaml = manifestToYaml(manifest);
  return { manifest, yaml, status: "success" };
}

function manifestToYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return `${pad}null\n`;
  if (typeof obj !== "object") {
    if (typeof obj === "string") return `${pad}${JSON.stringify(obj)}\n`;
    return `${pad}${obj}\n`;
  }
  if (Array.isArray(obj)) {
    if (!obj.length) return `${pad}[]\n`;
    return obj.map((item) => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const lines = manifestToYaml(item, indent + 1);
        return `${pad}-\n${lines}`;
      }
      const val = typeof item === "string" ? JSON.stringify(item) : item;
      return `${pad}- ${val}\n`;
    }).join("");
  }
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (v === null) return `${pad}${k}: null\n`;
      if (Array.isArray(v)) {
        if (!v.length) return `${pad}${k}: []\n`;
        return `${pad}${k}:\n${manifestToYaml(v, indent + 1)}`;
      }
      if (typeof v === "object") {
        const inner = manifestToYaml(v, indent + 1);
        return `${pad}${k}:\n${inner}`;
      }
      const scalar = typeof v === "string" ? JSON.stringify(v) : v;
      return `${pad}${k}: ${scalar}\n`;
    })
    .join("");
}
