"use strict";

const { randomUUID } = require("crypto");

function isAmazonQFixEnabled() {
  return (
    process.env.AMAZON_Q_FIX_ENABLED === "true" &&
    Boolean(process.env.AMAZON_Q_APPLICATION_ID?.trim())
  );
}

function amazonQUserId() {
  return process.env.AMAZON_Q_USER_ID?.trim() || "cognimesh-portal";
}

function buildFixPrompt(finding, plan, node, pipelineMeta) {
  return `You are Amazon Q helping fix an AWS data pipeline design review finding in CogniMesh.

Finding: ${finding.title} (${finding.severity})
Issue: ${finding.message}
Suggested fix: ${finding.fix || "see steps"}
Rule steps: ${(plan.steps || []).join(" | ")}
Block data: ${JSON.stringify(node?.data || {})}
Pipeline: ${pipelineMeta?.name || "pipeline"} / ${pipelineMeta?.domain || "default"}

Give a concise fix guide (max 120 words): numbered steps, which Properties panel fields to change, and one Terraform or IAM note if relevant. No markdown headers.`;
}

/**
 * Amazon Q Business ChatSync for design-review fix guidance.
 * Requires AMAZON_Q_FIX_ENABLED=true and AMAZON_Q_APPLICATION_ID.
 */
async function invokeAmazonQFixExplanation(finding, plan, node, pipelineMeta) {
  const { QBusinessClient, ChatSyncCommand } = require("@aws-sdk/client-qbusiness");
  const region = process.env.AMAZON_Q_REGION || process.env.AWS_REGION || "us-east-1";
  const client = new QBusinessClient({ region });

  const response = await client.send(
    new ChatSyncCommand({
      applicationId: process.env.AMAZON_Q_APPLICATION_ID,
      clientToken: randomUUID(),
      userId: amazonQUserId(),
      userMessage: buildFixPrompt(finding, plan, node, pipelineMeta),
    })
  );

  const text =
    response.systemMessage ||
    response.userMessage ||
    response?.sourceAttributions?.[0]?.snippet ||
    "";

  if (!text?.trim()) {
    throw new Error("Amazon Q returned an empty response");
  }
  return text.trim();
}

module.exports = {
  isAmazonQFixEnabled,
  invokeAmazonQFixExplanation,
  buildFixPrompt,
};
