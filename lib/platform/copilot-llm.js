"use strict";

const { listRuns } = require("../execution-history");
const { listProductHealthScores } = require("./health-score");
const { copilotRespond: ruleBasedCopilot } = require("./copilot");
const { isAmazonQFixEnabled, invokeAmazonQFixExplanation } = require("./amazon-q-fix");

function isCopilotLlmEnabled() {
  return process.env.COPILOT_LLM_ENABLED === "true";
}

function buildCopilotContext({ pipelineName, domain }) {
  const runs = listRuns({ pipelineName, domain, limit: 3 });
  const health = pipelineName
    ? listProductHealthScores(domain).find((p) => p.name === pipelineName)
    : null;
  return {
    pipelineName,
    domain,
    recentRuns: runs.map((r) => ({
      ts: r.ts,
      outcome: r.outcome,
      vrpVerdict: r.vrpVerdict,
      rowsDropped: r.rowsDropped,
    })),
    healthScore: health?.health?.score ?? null,
  };
}

async function invokeBedrockCopilot(message, context) {
  const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId =
    process.env.COPILOT_BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";
  const client = new BedrockRuntimeClient({ region });

  const system = `You are CogniMesh operations copilot. Help data engineers debug pipelines, VRP failures, costs, and deploy impact. Be concise (under 120 words). Context: ${JSON.stringify(context)}`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: message }],
  });

  const res = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    })
  );

  const parsed = JSON.parse(new TextDecoder().decode(res.body));
  const text = parsed.content?.[0]?.text || parsed.generation || "No response from model.";
  return text.trim();
}

async function copilotRespondAsync({ message, pipelineName, domain }) {
  const context = buildCopilotContext({ pipelineName, domain });

  if (isAmazonQFixEnabled()) {
    try {
      const reply = await invokeAmazonQFixExplanation(
        { title: "Operations copilot", severity: "info", message, fix: "" },
        { steps: [] },
        null,
        { name: pipelineName, domain }
      );
      return {
        mode: "amazon_q",
        reply,
        suggestions: ["Why did VRP fail?", "Show health score", "Explain deploy impact"],
        context,
      };
    } catch (err) {
      if (!isCopilotLlmEnabled()) {
        const fallback = ruleBasedCopilot({ message, pipelineName, domain });
        return { ...fallback, mode: "rules", llmError: err.message, context };
      }
    }
  }

  if (!isCopilotLlmEnabled()) {
    return { ...ruleBasedCopilot({ message, pipelineName, domain }), mode: "rules", context };
  }

  try {
    const reply = await invokeBedrockCopilot(message, context);
    return {
      mode: "llm",
      reply,
      suggestions: [
        "Why did VRP fail?",
        "Show health score",
        "Explain deploy impact",
      ],
      context,
    };
  } catch (err) {
    const fallback = ruleBasedCopilot({ message, pipelineName, domain });
    return {
      ...fallback,
      mode: "rules",
      llmError: err.message,
      context,
    };
  }
}

module.exports = { copilotRespondAsync, isCopilotLlmEnabled, buildCopilotContext };
