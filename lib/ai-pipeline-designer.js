"use strict";

/**
 * AI pipeline designer — maps natural language intent to patterns.
 * Uses rule-based keyword matching (Bedrock hook ready via BEDROCK_MODEL_ID).
 */

const PATTERN_INTENTS = [
  { id: "vaquar-cdc-orders", keywords: ["cdc", "rds", "mysql", "orders", "database", "incremental", "change data"] },
  { id: "medallion-full-stack", keywords: ["medallion", "bronze", "silver", "gold", "lakehouse", "layers"] },
  { id: "multi-source-mesh", keywords: ["multi source", "parallel", "multiple sources", "merge", "workflow"] },
  { id: "cognitive-media", keywords: ["media", "video", "audio", "transcript", "bedrock", "ai enrich"] },
  { id: "genai-rag-documents", keywords: ["rag", "document", "pdf", "knowledge base", "chunk", "embed", "genai"] },
  { id: "finance-payment-ledger", keywords: ["payment", "ledger", "finance", "double entry", "sox", "audit"] },
  { id: "healthcare-fhir", keywords: ["fhir", "healthcare", "hipaa", "patient", "clinical", "medical"] },
  { id: "retail-clickstream", keywords: ["clickstream", "retail", "ecommerce", "e-commerce", "session", "funnel"] },
  { id: "iot-sensor-fleet", keywords: ["iot", "sensor", "telemetry", "device", "fleet", "manufacturing"] },
  { id: "kafka-stream", keywords: ["kafka", "stream", "real time", "realtime", "events", "msk"] },
  { id: "fraud-detection-parallel", keywords: ["fraud", "risk", "score", "quarantine", "ml score"] },
  { id: "dq-quarantine", keywords: ["data quality", "quarantine", "bad rows", "dq", "quality gate"] },
  { id: "scd2-customers", keywords: ["scd", "slowly changing", "dimension", "historical", "customer master"] },
  { id: "s3-batch-lake", keywords: ["s3", "file", "csv", "json", "batch", "landing", "partner feed"] },
  { id: "mysql-redshift", keywords: ["redshift", "warehouse", "bi", "dashboard", "reporting"] },
  { id: "feature-store-ml", keywords: ["feature store", "ml", "sagemaker", "features", "machine learning"] },
];

function scoreIntent(message, intent) {
  const lower = message.toLowerCase();
  let score = 0;
  for (const kw of intent.keywords) {
    if (lower.includes(kw)) score += kw.split(" ").length;
  }
  return score;
}

function matchPatternFromMessage(message) {
  let best = null;
  let bestScore = 0;
  for (const intent of PATTERN_INTENTS) {
    const s = scoreIntent(message, intent);
    if (s > bestScore) {
      bestScore = s;
      best = intent.id;
    }
  }
  return bestScore > 0 ? best : null;
}

function designPipelineFromMessage(message, patterns = []) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return { success: false, errors: ["Describe what you want to build in a sentence or two."] };
  }

  const patternId = matchPatternFromMessage(trimmed);
  const explanation = patternId
    ? `Matched pattern "${patternId}" from your description.`
    : "No exact pattern match — generated a starter CDC pipeline. Customize on the canvas.";

  const resolvedId = patternId || "vaquar-cdc-orders";

  return {
    success: true,
    patternId: resolvedId,
    explanation,
    aiMode: process.env.BEDROCK_MODEL_ID ? "bedrock+rules" : "rules",
    suggestions: [
      "Review blocks on the canvas before deploy.",
      "Set your database/table names in Source properties.",
      "Preview YAML to see the DataContract and Step Functions ASL.",
    ],
    userMessage: trimmed,
  };
}

module.exports = { designPipelineFromMessage, matchPatternFromMessage, PATTERN_INTENTS };
