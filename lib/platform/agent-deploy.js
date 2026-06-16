"use strict";

/**
 * Deploy AgentCore manifest to AWS Bedrock Agents (CreateAgent + resources).
 * When AWS_AGENT_DEPLOY_ENABLED is not set, returns a simulated plan for local dev.
 */

function isAgentDeployEnabled() {
  return process.env.AWS_AGENT_DEPLOY_ENABLED === "true";
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

async function deployAgentToAws(manifest, { userEmail } = {}) {
  const resources = buildAgentResources(manifest);
  const region = process.env.AWS_REGION || "us-east-1";

  if (!isAgentDeployEnabled()) {
    return {
      deployed: false,
      simulated: true,
      reason: "Set AWS_AGENT_DEPLOY_ENABLED=true and configure IAM for Bedrock Agents",
      plan: {
        steps: [
          "CreateAgent IAM execution role",
          "CreateAgent with foundation model",
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
        errors: ["AWS_BEDROCK_AGENT_ROLE_ARN required when AWS_AGENT_DEPLOY_ENABLED=true"],
      };
    }

    const created = await client.send(
      new CreateAgentCommand({
        agentName: manifest.metadata.name,
        foundationModel: model,
        instruction: manifest.metadata.description || "CogniMesh AgentCore agent",
        agentResourceRoleArn: roleArn,
        idleSessionTTLInSeconds: 1800,
      })
    );

    let alias = null;
    if (created.agent?.agentId) {
      alias = await client.send(
        new CreateAgentAliasCommand({
          agentId: created.agent.agentId,
          agentAliasName: "live",
        })
      );
    }

    return {
      deployed: true,
      simulated: false,
      agentId: created.agent?.agentId,
      agentArn: created.agent?.agentArn,
      aliasId: alias?.agentAlias?.agentAliasId,
      region,
      deployedBy: userEmail || null,
      note: "Guardrails, KB, and action groups may require additional API calls — see manifest.",
    };
  } catch (err) {
    return {
      deployed: false,
      errors: [err.message],
      hint: "Install @aws-sdk/client-bedrock-agent and configure Bedrock Agent IAM",
    };
  }
}

module.exports = { deployAgentToAws, isAgentDeployEnabled, buildAgentResources };
