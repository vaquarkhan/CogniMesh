"use strict";

/**
 * Deploy AgentCore manifest to AWS Bedrock Agents (CreateAgent + Prepare + alias).
 * When AWS_AGENT_DEPLOY_ENABLED is not set, returns a simulated plan for local dev.
 */

function isAgentDeployEnabled() {
  if (process.env.AWS_AGENT_DEPLOY_ENABLED === "false") return false;
  if (process.env.AWS_AGENT_DEPLOY_ENABLED === "true") return true;
  // Prod ECS/terraform sets AWS_BEDROCK_AGENT_ROLE_ARN — enable real deploy automatically.
  return Boolean(process.env.AWS_BEDROCK_AGENT_ROLE_ARN?.trim());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BEDROCK_MIN_INSTRUCTION_LENGTH = 40;

/** Bedrock CreateAgent requires instruction length >= 40 characters. */
function normalizeAgentInstruction(instruction, agentName) {
  let text = (instruction || "").trim();
  if (!text) {
    text = `CogniMesh AgentCore agent for ${agentName || "data mesh workflows"}.`;
  }
  while (text.length < BEDROCK_MIN_INSTRUCTION_LENGTH) {
    text += " Follows CogniMesh governance and safety policies.";
  }
  return text;
}

function buildAgentResources(manifest) {
  const spec = manifest.spec || {};
  return {
    agentName: manifest.metadata?.name,
    foundationModels: spec.foundationModels || [],
    guardrails: spec.guardrails || [],
    knowledgeBases: spec.knowledgeBases || [],
    tools: spec.tools || [],
    environmentVariables: spec.environmentVariables || {},
    runtime: spec.runtime || {},
  };
}

async function waitForAgentPrepared(client, agentId, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const { GetAgentCommand } = require("@aws-sdk/client-bedrock-agent");
    const got = await client.send(new GetAgentCommand({ agentId }));
    const status = got.agent?.agentStatus;

    if (status === "PREPARED") return got.agent;
    if (status === "FAILED") {
      throw new Error(got.agent?.failureReasons?.join("; ") || "Agent preparation failed");
    }
    if (status === "NOT_PREPARED") {
      const { PrepareAgentCommand } = require("@aws-sdk/client-bedrock-agent");
      await client.send(new PrepareAgentCommand({ agentId }));
    }

    await sleep(3000);
  }
  throw new Error("Timed out waiting for Bedrock agent to reach PREPARED state");
}

async function deployAgentToAws(manifest, { userEmail } = {}) {
  const resources = buildAgentResources(manifest);
  const region = process.env.AWS_REGION || "us-east-1";

  if (!isAgentDeployEnabled()) {
    return {
      deployed: false,
      simulated: true,
      reason: process.env.AWS_BEDROCK_AGENT_ROLE_ARN
        ? "Agent deploy is disabled (AWS_AGENT_DEPLOY_ENABLED=false)"
        : "Set AWS_BEDROCK_AGENT_ROLE_ARN on the API server (terraform output bedrock_agent_role_arn)",
      plan: {
        steps: [
          "CreateAgent IAM execution role",
          "CreateAgent with foundation model",
          "PrepareAgent (wait for PREPARED)",
          ...(resources.guardrails.length ? ["Associate Bedrock Guardrail"] : []),
          ...(resources.knowledgeBases.length ? ["Create/associate Knowledge Base"] : []),
          ...(resources.tools.length ? ["Register Lambda action groups"] : []),
          "Create agent alias (live)",
        ],
        resources,
        region,
      },
      agentId: `sim-${manifest.metadata?.name}-${Date.now()}`,
      message: "Agent deploy simulated locally. Manifest is valid for AWS CLI/Terraform.",
    };
  }

  let created = null;
  try {
    const {
      BedrockAgentClient,
      CreateAgentCommand,
      CreateAgentAliasCommand,
    } = require("@aws-sdk/client-bedrock-agent");

    const client = new BedrockAgentClient({ region });
    const model = resources.foundationModels[0]?.modelId || "anthropic.claude-3-sonnet-20240229-v1:0";
    const roleArn = process.env.AWS_BEDROCK_AGENT_ROLE_ARN;
    if (!roleArn) {
      return {
        deployed: false,
        errors: [
          "AWS_BEDROCK_AGENT_ROLE_ARN required when AWS_AGENT_DEPLOY_ENABLED=true",
          "Run dev terraform (enable_platform_ops=true) then: terraform output -raw bedrock_agent_role_arn",
        ],
      };
    }

    created = await client.send(
      new CreateAgentCommand({
        agentName: manifest.metadata.name,
        foundationModel: model,
        instruction: normalizeAgentInstruction(
          manifest.metadata.description,
          manifest.metadata.name
        ),
        agentResourceRoleArn: roleArn,
        idleSessionTTLInSeconds: 1800,
      })
    );

    const agentId = created.agent?.agentId;
    if (!agentId) {
      return { deployed: false, errors: ["CreateAgent returned no agentId"] };
    }

    await waitForAgentPrepared(client, agentId);

    let alias = null;
    const resourceSteps = ["PrepareAgent completed"];

    alias = await client.send(
      new CreateAgentAliasCommand({
        agentId,
        agentAliasName: "live",
      })
    );
    resourceSteps.push("Created alias live");

    const {
      AssociateAgentKnowledgeBaseCommand,
      AssociateAgentGuardrailCommand,
    } = require("@aws-sdk/client-bedrock-agent");

    for (const kb of resources.knowledgeBases) {
      const kbId = kb.knowledgeBaseId || kb.id || process.env.AWS_BEDROCK_KB_ID;
      if (!kbId) continue;
      await client.send(
        new AssociateAgentKnowledgeBaseCommand({
          agentId,
          knowledgeBaseId: kbId,
          description: kb.description || "CogniMesh KB",
          knowledgeBaseState: "ENABLED",
        })
      );
      resourceSteps.push(`Associated KB ${kbId}`);
    }

    for (const gr of resources.guardrails) {
      const grId = gr.guardrailId || gr.id || process.env.AWS_BEDROCK_GUARDRAIL_ID;
      if (!grId) continue;
      await client.send(
        new AssociateAgentGuardrailCommand({
          agentId,
          guardrailId: grId,
          guardrailVersion: gr.version || "DRAFT",
        })
      );
      resourceSteps.push(`Associated guardrail ${grId}`);
    }

    return {
      deployed: true,
      simulated: false,
      agentId,
      agentArn: created.agent?.agentArn,
      aliasId: alias?.agentAlias?.agentAliasId,
      region,
      deployedBy: userEmail || null,
      resourceSteps,
      note:
        resourceSteps.length > 1
          ? `Agent created with ${resourceSteps.length} step(s)`
          : "Agent created and alias live",
    };
  } catch (err) {
    return {
      deployed: Boolean(created?.agent?.agentId),
      partial: Boolean(created?.agent?.agentId),
      simulated: false,
      agentId: created?.agent?.agentId || null,
      agentArn: created?.agent?.agentArn || null,
      errors: [err.message],
      hint: "If agent exists in Bedrock console, finish PrepareAgent or create alias manually",
    };
  }
}

module.exports = {
  deployAgentToAws,
  isAgentDeployEnabled,
  buildAgentResources,
  waitForAgentPrepared,
  normalizeAgentInstruction,
};
