"use strict";

/**
 * AI agent designer - maps natural language to AgentCore templates.
 * Keep in sync with portal/src/lib/ai-agent-designer.js
 */

const AGENT_INTENTS = [
  { id: "customer-support", keywords: ["customer support", "help desk", "tier 1", "faq", "order status", "returns"] },
  { id: "rag-doc-qa", keywords: ["rag", "document", "pdf", "knowledge base", "q&a", "runbook", "policy docs"] },
  { id: "data-analyst", keywords: ["data analyst", "athena", "sql", "analytics", "mesh catalog", "natural language sql"] },
  { id: "fraud-detection", keywords: ["fraud", "investigation", "transaction", "risk analyst", "hitl", "case"] },
  { id: "code-review", keywords: ["code review", "pull request", "pr review", "static analysis", "github"] },
  { id: "hr-policy", keywords: ["hr", "handbook", "employee", "benefits", "pto", "human resources"] },
  { id: "multi-agent-supervisor", keywords: ["multi agent", "supervisor", "orchestrator", "sub agent", "router"] },
  { id: "cognimesh-steward", keywords: ["steward", "governance", "lake formation", "access request", "cognimesh", "mesh steward"] },
  { id: "devops-sre", keywords: ["devops", "sre", "site reliability", "on-call", "oncall", "incident", "runbook", "cicd", "ci/cd", "terraform", "kubernetes", "eks", "ecs", "deploy pipeline", "cloudwatch"] },
  { id: "custom-agent-starter", keywords: ["custom agent", "build my own", "bespoke agent", "from scratch", "blank template", "starter template", "wire my own tools"] },
];

function scoreIntent(message, intent) {
  const lower = message.toLowerCase();
  let score = 0;
  for (const kw of intent.keywords) {
    if (lower.includes(kw)) score += kw.split(" ").length;
  }
  return score;
}

function matchAgentTemplateFromMessage(message) {
  let best = null;
  let bestScore = 0;
  for (const intent of AGENT_INTENTS) {
    const s = scoreIntent(message, intent);
    if (s > bestScore) {
      bestScore = s;
      best = intent.id;
    }
  }
  return bestScore > 0 ? best : null;
}

function designAgentFromMessage(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return { success: false, errors: ["Describe the agent you want to build."] };
  }

  const templateId = matchAgentTemplateFromMessage(trimmed);
  const resolvedId = templateId || "custom-agent-starter";
  const explanation = templateId
    ? `Matched AgentCore template "${templateId}" from your description.`
    : "No exact template match - loaded Custom Agent Starter.";

  return {
    success: true,
    templateId: resolvedId,
    explanation,
    aiMode: process.env.BEDROCK_MODEL_ID ? "bedrock+rules" : "rules",
    suggestions: [
      "Use feature checkboxes to include guardrails, memory, KB, and tools.",
      "Review guardrails and tools on the Agent Builder canvas.",
      "Set guardrail IDs before deploy.",
    ],
    userMessage: trimmed,
  };
}

module.exports = { designAgentFromMessage, matchAgentTemplateFromMessage, AGENT_INTENTS };
