/**
 * Amazon Bedrock AgentCore block palette - Runtime, Gateway, Memory, Guardrails, Tools.
 */

export const AGENT_BLOCK_CATEGORIES = [
  { id: "core", label: "AgentCore Runtime", hint: "Runtime orchestrator · session isolation · Firecracker microVM" },
  { id: "model", label: "Foundation model", hint: "Bedrock Claude, Nova, or external model" },
  { id: "tools", label: "Tools & Gateway", hint: "Lambda, MCP, OpenAPI, Code Interpreter, Browser" },
  { id: "knowledge", label: "Knowledge & memory", hint: "Bedrock KB, session memory, long-term memory" },
  { id: "safety", label: "Guardrails & identity", hint: "Content filters, PII, topics, AgentCore Identity" },
  { id: "ops", label: "Observability", hint: "CloudWatch traces, human-in-the-loop" },
];

const coreBlocks = [
  {
    category: "core",
    type: "runtime",
    label: "AgentCore Runtime",
    defaults: {
      label: "AgentCore Runtime",
      blockType: "runtime",
      framework: "strands",
      sessionIsolation: true,
      maxDurationHours: 8,
      detail: "⚡ AgentCore Runtime",
    },
  },
  {
    category: "core",
    type: "supervisor",
    label: "Multi-Agent Supervisor",
    defaults: {
      label: "Supervisor",
      blockType: "supervisor",
      subAgentCount: 2,
      routingStrategy: "capability",
      detail: "🧩 Multi-agent router",
    },
  },
];

const modelBlocks = [
  {
    category: "model",
    type: "model-claude",
    label: "Claude (Bedrock)",
    defaults: {
      label: "Claude Sonnet",
      blockType: "foundation_model",
      modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      temperature: 0.3,
      maxTokens: 4096,
      detail: "🤖 Claude · Bedrock",
    },
  },
  {
    category: "model",
    type: "model-nova",
    label: "Amazon Nova",
    defaults: {
      label: "Amazon Nova Pro",
      blockType: "foundation_model",
      modelId: "amazon.nova-pro-v1:0",
      temperature: 0.4,
      maxTokens: 4096,
      detail: "🤖 Nova · Bedrock",
    },
  },
];

const toolBlocks = [
  {
    category: "tools",
    type: "gateway",
    label: "AgentCore Gateway",
    defaults: {
      label: "AgentCore Gateway",
      blockType: "gateway",
      authMode: "dual",
      protocols: ["mcp", "openapi", "lambda"],
      detail: "🌐 Gateway · MCP + API",
    },
  },
  {
    category: "tools",
    type: "tool-lambda",
    label: "Lambda Action",
    defaults: {
      label: "Lambda Tool",
      blockType: "tool_lambda",
      functionName: "agent-action-handler",
      description: "Execute a business action via Lambda",
      detail: "λ Lambda action group",
    },
  },
  {
    category: "tools",
    type: "tool-mcp",
    label: "MCP Server",
    defaults: {
      label: "MCP Server",
      blockType: "tool_mcp",
      serverUrl: "http://localhost:3100/mcp",
      tools: ["cognimesh_invoke_agent", "cognimesh_list_products"],
      detail: "🔌 MCP tools",
    },
  },
  {
    category: "tools",
    type: "tool-api",
    label: "OpenAPI / REST",
    defaults: {
      label: "REST API Tool",
      blockType: "tool_api",
      openApiSpec: "https://api.example.com/openapi.json",
      authType: "oauth2",
      detail: "📡 OpenAPI tool",
    },
  },
  {
    category: "tools",
    type: "code-interpreter",
    label: "Code Interpreter",
    defaults: {
      label: "Code Interpreter",
      blockType: "code_interpreter",
      languages: ["python"],
      sandbox: true,
      detail: "💻 AgentCore Code Interpreter",
    },
  },
  {
    category: "tools",
    type: "browser",
    label: "Browser Tool",
    defaults: {
      label: "Browser Tool",
      blockType: "browser",
      headless: true,
      allowedDomains: ["*.amazonaws.com"],
      detail: "🌍 AgentCore Browser",
    },
  },
];

const knowledgeBlocks = [
  {
    category: "knowledge",
    type: "knowledge-base",
    label: "Knowledge Base",
    defaults: {
      label: "Bedrock KB",
      blockType: "knowledge_base",
      kbId: "kb-docs-001",
      embeddingModel: "amazon.titan-embed-text-v2:0",
      retrievalMode: "hybrid",
      detail: "📚 Bedrock Knowledge Base",
    },
  },
  {
    category: "knowledge",
    type: "memory-session",
    label: "Session Memory",
    defaults: {
      label: "Session Memory",
      blockType: "memory_session",
      ttlMinutes: 60,
      maxTurns: 20,
      detail: "🧠 Short-term session",
    },
  },
  {
    category: "knowledge",
    type: "memory-long",
    label: "Long-Term Memory",
    defaults: {
      label: "Long-Term Memory",
      blockType: "memory_long",
      extractionMode: "semantic",
      retentionDays: 90,
      detail: "🗄 Semantic memory",
    },
  },
];

const safetyBlocks = [
  {
    category: "safety",
    type: "guardrail-standard",
    label: "Content Guardrail",
    defaults: {
      label: "Content Guardrail",
      blockType: "guardrail",
      guardrailId: "gr-content-standard",
      version: "1",
      contentFilters: { hate: "HIGH", violence: "HIGH", sexual: "HIGH" },
      deniedTopics: ["investment advice", "medical diagnosis"],
      detail: "🛡 Content + topics",
    },
  },
  {
    category: "safety",
    type: "guardrail-pii",
    label: "PII Guardrail",
    defaults: {
      label: "PII Guardrail",
      blockType: "guardrail",
      guardrailId: "gr-pii-strict",
      version: "1",
      piiEntities: ["EMAIL", "PHONE", "SSN", "CREDIT_DEBIT_NUMBER"],
      piiAction: "BLOCK",
      detail: "🔒 PII filter",
    },
  },
  {
    category: "safety",
    type: "identity",
    label: "AgentCore Identity",
    defaults: {
      label: "AgentCore Identity",
      blockType: "identity",
      authProvider: "cognito",
      scopePolicy: "user-context",
      detail: "🪪 Identity · IAM",
    },
  },
];

const opsBlocks = [
  {
    category: "ops",
    type: "observability",
    label: "Observability",
    defaults: {
      label: "Observability",
      blockType: "observability",
      traces: true,
      cloudWatch: true,
      xray: true,
      detail: "📊 Traces · CloudWatch",
    },
  },
  {
    category: "ops",
    type: "human-loop",
    label: "Human-in-the-Loop",
    defaults: {
      label: "Human Review",
      blockType: "human_loop",
      approvalThreshold: "high_risk",
      timeoutMinutes: 30,
      detail: "👤 HITL approval",
    },
  },
];

export const AGENT_BLOCKS = [
  ...coreBlocks,
  ...modelBlocks,
  ...toolBlocks,
  ...knowledgeBlocks,
  ...safetyBlocks,
  ...opsBlocks,
];

export function agentBlocksByCategory() {
  return AGENT_BLOCK_CATEGORIES.map((cat) => ({
    ...cat,
    blocks: AGENT_BLOCKS.filter((b) => b.category === cat.id),
  })).filter((c) => c.blocks.length > 0);
}

export const AGENT_FRAMEWORKS = [
  { id: "strands", label: "Strands SDK" },
  { id: "langchain", label: "LangChain" },
  { id: "crewai", label: "CrewAI" },
  { id: "openai-agents", label: "OpenAI Agents SDK" },
  { id: "custom", label: "Custom container" },
];

export const GUARDRAIL_PII_ACTIONS = ["BLOCK", "ANONYMIZE", "NONE"];
