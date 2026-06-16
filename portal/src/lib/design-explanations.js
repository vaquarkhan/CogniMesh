/**
 * Natural-language plans explaining what AI Builder will create and how it works.
 */

import { AGENT_FEATURES } from "./agent-feature-options";

function enabledFeatureLabels(features) {
  if (!features) return [];
  return AGENT_FEATURES.filter((f) => features[f.id] !== false).map((f) => f.label);
}

function nodeLabels(templateOrPattern) {
  return (templateOrPattern.nodes || []).map((n) => n.data?.label).filter(Boolean);
}

/** Rich creation plan for a matched pipeline pattern. */
export function buildPipelineCreationPlan(pattern) {
  if (!pattern) return null;

  const services = pattern.awsServices?.length
    ? pattern.awsServices
    : inferPipelineServices(pattern);

  const flow = pattern.exampleFlow || pattern.architectureDiagram || summarizeNodeFlow(pattern);

  const whatWeCreate = [
    `We'll load the **${pattern.name}** pattern on your canvas - ${pattern.description || pattern.subtitle || "a governed AWS data pipeline"}.`,
    pattern.exampleScenario ? `In practice: ${pattern.exampleScenario}` : null,
    pattern.whenToUse ? `Best when ${pattern.whenToUse.charAt(0).toLowerCase()}${pattern.whenToUse.slice(1)}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const howItWorks = buildPipelineHowItWorks(pattern, flow, services);

  return {
    kind: "pipeline",
    title: pattern.name,
    subtitle: pattern.subtitle || pattern.category,
    badge: pattern.badge || pattern.architecture,
    whatWeCreate,
    howItWorks,
    flow,
    awsServices: services,
    whenToUse: pattern.whenToUse,
    tips: pattern.customizeTips || [],
    blockCount: pattern.nodes?.length || 0,
  };
}

function inferPipelineServices(pattern) {
  const labels = new Set();
  for (const n of pattern.nodes || []) {
    const svc = n.data?.awsService;
    if (svc) labels.add(svc.toUpperCase());
    const bt = n.data?.blockType;
    if (bt === "source" && n.data?.sourceType) labels.add(n.data.sourceType.toUpperCase());
    if (bt === "sink" && n.data?.targetType) labels.add(n.data.targetType.toUpperCase());
  }
  return [...labels];
}

function summarizeNodeFlow(pattern) {
  const labels = nodeLabels(pattern);
  if (labels.length < 2) return null;
  return labels.join(" → ");
}

function buildPipelineHowItWorks(pattern, flow, services) {
  const steps = [];
  const arch = pattern.architecture || pattern.category || "";

  if (/mesh/i.test(arch) || /mesh/i.test(pattern.name)) {
    steps.push(
      "Domain teams ingest from their sources (RDS, Kafka, S3) in parallel across federated AWS accounts.",
      "Bronze → silver → gold transforms conform data to domain contracts.",
      "A mesh integrity gate (PVDM / VRP) verifies quality before gold tables are published.",
      "Lake Formation and the marketplace register the data product for governed consumer access."
    );
  } else if (/kappa/i.test(arch)) {
    steps.push(
      "All data flows through a single streaming path - no separate batch layer.",
      "Kinesis (or MSK) captures events; Glue streaming or Flink processes windows in near real time.",
      "Results land in Iceberg gold tables; consumers replay from the stream log when logic changes."
    );
  } else if (/lambda/i.test(arch)) {
    steps.push(
      "The batch layer processes historical data on a schedule (S3 → Glue ETL → Iceberg).",
      "The speed layer handles recent events in real time (Kinesis → stream processor → Iceberg).",
      "A merge step combines batch and speed outputs into one serving view (Athena UNION)."
    );
  } else if (/medallion|lakehouse/i.test(arch + pattern.name)) {
    steps.push(
      "Raw data lands in bronze with minimal transformation.",
      "Silver applies typing, deduplication, and business rules.",
      "Gold exposes curated Iceberg tables optimized for analytics and mesh publication."
    );
  } else {
    steps.push(
      "Sources extract or stream data into the pipeline entry point.",
      "Transforms apply ETL/ELT, enrichment, or quality gates along the graph.",
      "Sinks write durable tables (Iceberg, S3, Redshift) and register metadata for discovery."
    );
  }

  if (flow) {
    steps.push(`On the canvas you'll see this flow: ${flow}.`);
  }

  if (services.length) {
    steps.push(`AWS services wired in this pattern: ${services.join(", ")}.`);
  }

  steps.push(
    "Edit block properties (database names, S3 paths, SQL) then Preview YAML to generate your DataContract and Step Functions definition."
  );

  return steps;
}

/** Rich creation plan for a matched agent template + selected features. */
export function buildAgentCreationPlan(template, features) {
  if (!template) return null;

  const featureLabels = enabledFeatureLabels(features);
  const services = template.awsServices || [];
  const flow = summarizeAgentFlow(template, features);

  const whatWeCreate = [
    `We'll create **${template.name}** - ${template.description}`,
    featureLabels.length
      ? `With your selected features: ${featureLabels.join(", ")}.`
      : null,
    template.whenToUse ? `Ideal for: ${template.whenToUse}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const howItWorks = buildAgentHowItWorks(template, features, flow, services);

  return {
    kind: "agent",
    title: template.name,
    subtitle: template.subtitle,
    badge: template.badge || template.framework,
    whatWeCreate,
    howItWorks,
    flow,
    awsServices: services,
    features: featureLabels,
    whenToUse: template.whenToUse,
    tips: template.customizeTips || [],
    blockCount: template.nodes?.length || 0,
  };
}

function summarizeAgentFlow(template, features) {
  const parts = ["User message"];
  parts.push("AgentCore Runtime");
  if (features?.knowledgeBase !== false && template.nodes?.some((n) => n.data?.blockType === "knowledge_base")) {
    parts.push("Knowledge Base retrieval");
  }
  parts.push("Bedrock model");
  if (features?.guardrails !== false) parts.push("Guardrails (input/output)");
  if (features?.gateway !== false && template.nodes?.some((n) => ["gateway", "tool_lambda", "tool_mcp"].includes(n.data?.blockType))) {
    parts.push("Gateway → tools");
  }
  parts.push("Response to user");
  return parts.join(" → ");
}

function buildAgentHowItWorks(template, features, flow, services) {
  const steps = [];

  steps.push(
    `A user sends a message to **${template.agentMeta?.name || template.name}** running on AgentCore Runtime with session isolation.`
  );

  if (features?.memorySession !== false) {
    steps.push("Session memory keeps recent turns in context so follow-up questions stay coherent.");
  }
  if (features?.memoryLong) {
    steps.push("Long-term memory extracts facts across sessions for personalized responses.");
  }

  if (features?.knowledgeBase !== false) {
    steps.push(
      "Bedrock Knowledge Base retrieves relevant chunks (hybrid search) and augments the model prompt - answers cite your documents."
    );
  } else {
    steps.push("The foundation model (Claude on Bedrock) reasons over the user message and tool results.");
  }

  if (features?.guardrails !== false) {
    steps.push(
      "Guardrails screen inputs and outputs for blocked topics, harmful content, and PII before anything is returned or logged."
    );
  }

  if (features?.gateway !== false) {
    steps.push(
      "When the model needs an action, AgentCore Gateway routes to Lambda, MCP, or REST tools with per-user auth."
    );
  }
  if (features?.codeInterpreter) {
    steps.push("Code Interpreter runs sandboxed Python for analysis or codegen tasks.");
  }
  if (features?.browser) {
    steps.push("Browser tool fetches live web pages within allowed domains.");
  }
  if (features?.identity) {
    steps.push("AgentCore Identity scopes tool access to the signed-in user's IAM or Cognito context.");
  }
  if (features?.humanLoop) {
    steps.push("High-risk tool calls pause for human approval before execution.");
  }
  if (features?.observability !== false) {
    steps.push("CloudWatch traces and metrics record each step for debugging and audit.");
  }

  if (flow) {
    steps.push(`End-to-end path: ${flow}.`);
  }

  if (services.length) {
    steps.push(`AWS components: ${services.join(", ")}.`);
  }

  steps.push(
    "On the canvas you can drag blocks, edit guardrail IDs and tool names, then Preview manifest to export AgentCore YAML."
  );

  return steps;
}
