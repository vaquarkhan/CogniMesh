/**
 * Agent creation feature toggles - guardrails, memory, KB, tools, etc.
 */

import { AGENT_BLOCKS } from "./agent-blocks";

export const AGENT_FEATURES = [
  {
    id: "guardrails",
    label: "Guardrails",
    description: "Content filters, denied topics, PII block or anonymize",
    blockTypes: ["guardrail"],
    defaultOn: true,
    addBlockType: "guardrail-standard",
  },
  {
    id: "memorySession",
    label: "Session memory",
    description: "Short-term conversation context with TTL and turn limits",
    blockTypes: ["memory_session"],
    defaultOn: true,
    addBlockType: "memory-session",
  },
  {
    id: "memoryLong",
    label: "Long-term memory",
    description: "Semantic memory retained across sessions",
    blockTypes: ["memory_long"],
    defaultOn: false,
    addBlockType: "memory-long",
  },
  {
    id: "knowledgeBase",
    label: "Knowledge base",
    description: "Bedrock KB hybrid retrieval for RAG",
    blockTypes: ["knowledge_base"],
    defaultOn: true,
    addBlockType: "knowledge-base",
  },
  {
    id: "gateway",
    label: "Gateway & tools",
    description: "AgentCore Gateway with Lambda, MCP, and REST actions",
    blockTypes: ["gateway", "tool_lambda", "tool_mcp", "tool_api"],
    defaultOn: true,
    addBlockType: "gateway",
  },
  {
    id: "codeInterpreter",
    label: "Code interpreter",
    description: "Sandboxed Python for data analysis and codegen",
    blockTypes: ["code_interpreter"],
    defaultOn: false,
    addBlockType: "code-interpreter",
  },
  {
    id: "browser",
    label: "Browser tool",
    description: "Headless browsing for live web data",
    blockTypes: ["browser"],
    defaultOn: false,
    addBlockType: "browser",
  },
  {
    id: "identity",
    label: "AgentCore Identity",
    description: "Cognito or IAM-scoped user context for tools",
    blockTypes: ["identity"],
    defaultOn: false,
    addBlockType: "identity",
  },
  {
    id: "observability",
    label: "Observability",
    description: "CloudWatch traces, metrics, and X-Ray",
    blockTypes: ["observability"],
    defaultOn: true,
    addBlockType: "observability",
  },
  {
    id: "humanLoop",
    label: "Human-in-the-loop",
    description: "Approval queue before high-risk tool calls",
    blockTypes: ["human_loop"],
    defaultOn: false,
    addBlockType: "human-loop",
  },
];

const PROTECTED_BLOCK_TYPES = new Set(["runtime", "foundation_model", "supervisor"]);

const BLOCK_TYPE_TO_FEATURE = {};
for (const feat of AGENT_FEATURES) {
  for (const bt of feat.blockTypes) {
    BLOCK_TYPE_TO_FEATURE[bt] = feat.id;
  }
}

export function defaultAgentFeatures(overrides = {}) {
  const features = {};
  for (const feat of AGENT_FEATURES) {
    features[feat.id] = feat.id in overrides ? overrides[feat.id] : feat.defaultOn;
  }
  return features;
}

/** Suggest checkboxes from natural-language agent description. */
export function inferAgentFeaturesFromMessage(message) {
  const lower = String(message || "").toLowerCase();
  const features = defaultAgentFeatures();

  if (/\bno guardrail|\bwithout guardrail|\bskip guardrail/.test(lower)) features.guardrails = false;
  if (/\bguardrail|\bpii\b|content filter|topic restrict/.test(lower)) features.guardrails = true;

  if (/\bno memory|\bwithout memory/.test(lower)) {
    features.memorySession = false;
    features.memoryLong = false;
  }
  if (/\bmemory\b|session context|remember user/.test(lower)) features.memorySession = true;
  if (/long.?term memory|semantic memory|persistent memory/.test(lower)) features.memoryLong = true;

  if (/\bknowledge base|\bkb\b|\brag\b|document|faq|handbook/.test(lower)) features.knowledgeBase = true;
  if (/\bathena\b|\blambda\b|\bmcp\b|\btool\b|gateway|marketplace/.test(lower)) features.gateway = true;
  if (/code interpreter|python sandbox|run code/.test(lower)) features.codeInterpreter = true;
  if (/\bbrowser\b|web browse|scrape/.test(lower)) features.browser = true;
  if (/\bidentity\b|\bcognito\b|\biam\b|lake formation/.test(lower)) features.identity = true;
  if (/human.in.the.loop|\bhitl\b|approval|human review/.test(lower)) features.humanLoop = true;
  if (/observability|traces|cloudwatch/.test(lower)) features.observability = true;
  if (/\bdevops\b|\bsre\b|on.call|runbook|\bcicd\b|ci\/cd|terraform|\beks\b|incident/.test(lower)) {
    features.gateway = true;
    features.knowledgeBase = true;
    features.observability = true;
    features.humanLoop = true;
  }
  if (/custom agent|build my own|bespoke|wire my own/.test(lower)) {
    features.guardrails = true;
    features.gateway = true;
    features.observability = true;
  }

  return features;
}

function paletteBlock(addBlockType) {
  return AGENT_BLOCKS.find((b) => b.type === addBlockType);
}

function hasFeatureBlock(nodes, feat) {
  return nodes.some((n) => feat.blockTypes.includes(n.data?.blockType));
}

function nextAddPosition(runtime, index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: runtime.position.x + 240 + col * 200,
    y: runtime.position.y + 80 + row * 140,
  };
}

function addMissingFeatureBlocks(nodes, edges, runtime, features) {
  const nextNodes = [...nodes];
  const nextEdges = [...edges];
  let addIndex = 0;

  for (const feat of AGENT_FEATURES) {
    if (!features[feat.id]) continue;
    if (hasFeatureBlock(nextNodes, feat)) continue;
    if (!feat.addBlockType) continue;

    const block = paletteBlock(feat.addBlockType);
    if (!block) continue;

    const newId = `agent-added-${feat.id}`;
    const position = nextAddPosition(runtime, addIndex++);
    nextNodes.push({
      id: newId,
      type: "agent",
      position,
      data: { ...block.defaults },
    });

    if (feat.id === "gateway") {
      continue;
    }
    if (["tool_lambda", "tool_mcp", "tool_api", "code_interpreter", "browser"].includes(block.defaults.blockType)) {
      const gw = nextNodes.find((n) => n.data?.blockType === "gateway");
      if (gw) {
        nextEdges.push({
          id: `ae-add-gw-${newId}`,
          source: gw.id,
          target: newId,
          animated: true,
        });
      }
      continue;
    }

    nextEdges.push({
      id: `ae-add-rt-${newId}`,
      source: runtime.id,
      target: newId,
      animated: true,
    });
  }

  return { nodes: nextNodes, edges: nextEdges };
}

/**
 * Filter template nodes/edges by feature checkboxes; add blocks for enabled features missing from template.
 */
export function applyAgentFeatures(instance, features) {
  const enabled = features || defaultAgentFeatures();

  let nodes = instance.nodes.filter((n) => {
    const bt = n.data?.blockType;
    if (PROTECTED_BLOCK_TYPES.has(bt)) return true;
    const featureId = BLOCK_TYPE_TO_FEATURE[bt];
    if (!featureId) return true;
    return enabled[featureId] !== false;
  });

  const keptIds = new Set(nodes.map((n) => n.id));
  let edges = instance.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

  const runtime = nodes.find((n) => PROTECTED_BLOCK_TYPES.has(n.data?.blockType));
  if (runtime) {
    const added = addMissingFeatureBlocks(nodes, edges, runtime, enabled);
    nodes = added.nodes;
    edges = added.edges;
  }

  return {
    ...instance,
    nodes,
    edges,
    agentMeta: {
      ...instance.agentMeta,
      features: { ...enabled },
    },
  };
}
