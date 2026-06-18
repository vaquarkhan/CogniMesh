"use strict";

const { isCopilotLlmEnabled } = require("./copilot-llm");
const { isAmazonQFixEnabled, invokeAmazonQFixExplanation } = require("./amazon-q-fix");

async function invokeBedrockFixExplanation(finding, plan, node, pipelineMeta) {
  const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId =
    process.env.COPILOT_BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";
  const client = new BedrockRuntimeClient({ region });

  const prompt = `You are an AWS data architect helping fix CogniMesh pipeline design review findings.
Finding: ${finding.title} (${finding.severity})
Issue: ${finding.message}
Rule fix: ${finding.fix}
Block data: ${JSON.stringify(node?.data || {})}
Pipeline: ${pipelineMeta?.name} / ${pipelineMeta?.domain}

Give a concise fix guide (max 100 words): numbered steps, which Properties panel fields to change, and one Terraform or IAM note if relevant. No markdown headers.`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 350,
    messages: [{ role: "user", content: prompt }],
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
  return (parsed.content?.[0]?.text || parsed.generation || "").trim();
}

/**
 * Enrich fix plans with Amazon Q (preferred) or Bedrock when enabled.
 * @returns {Promise<Array>} plans with aiExplanation + mode
 */
async function enrichFixPlansWithAi(plans, { findings, nodes, pipelineMeta }) {
  if (!isAmazonQFixEnabled() && !isCopilotLlmEnabled()) return plans;

  const byId = new Map(findings.map((f) => [f.id, f]));
  const out = [];

  for (const plan of plans) {
    const finding = byId.get(plan.findingId);
    const node = plan.nodeId ? nodes.find((n) => n.id === plan.nodeId) : null;

    if (isAmazonQFixEnabled()) {
      try {
        const aiExplanation = await invokeAmazonQFixExplanation(finding, plan, node, pipelineMeta);
        out.push({ ...plan, aiExplanation, mode: "amazon_q" });
        continue;
      } catch (err) {
        if (!isCopilotLlmEnabled()) {
          out.push({
            ...plan,
            aiExplanation: `Amazon Q unavailable (${err.message}). Use the steps above.`,
            mode: "rules",
          });
          continue;
        }
      }
    }

    if (isCopilotLlmEnabled()) {
      try {
        const aiExplanation = await invokeBedrockFixExplanation(finding, plan, node, pipelineMeta);
        out.push({ ...plan, aiExplanation, mode: "llm" });
      } catch (err) {
        out.push({
          ...plan,
          aiExplanation: `AI unavailable (${err.message}). Use the steps above.`,
          mode: "rules",
        });
      }
      continue;
    }

    out.push(plan);
  }

  return out;
}

module.exports = {
  enrichFixPlansWithAi,
  invokeBedrockFixExplanation,
};
