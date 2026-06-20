"use strict";

/**
 * Deploy AgentCore manifest to AWS Bedrock Agents (CreateAgent + Prepare + alias).
 * When AWS_AGENT_DEPLOY_ENABLED is not set, returns a simulated plan for local dev.
 * Idempotent: reuses existing agents by name. Substitutes dead/legacy models.
 */

function isAgentDeployEnabled() {
  if (process.env.AWS_AGENT_DEPLOY_ENABLED === "false") return false;
  if (process.env.AWS_AGENT_DEPLOY_ENABLED === "true") return true;
  return Boolean(process.env.AWS_BEDROCK_AGENT_ROLE_ARN?.trim());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BEDROCK_MIN_INSTRUCTION_LENGTH = 40;

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

function validateAgentInstruction(instruction) {
  const text = (instruction || "").trim();
  if (text.length >= BEDROCK_MIN_INSTRUCTION_LENGTH) return { valid: true };
  return {
    valid: false,
    message: `Agent instruction must be at least ${BEDROCK_MIN_INSTRUCTION_LENGTH} characters (currently ${text.length}). Add a description in Agent settings.`,
  };
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
      consoleUrl: null,
      message: "Agent deploy simulated locally. Manifest is valid for AWS CLI/Terraform.",
    };
  }

  let created = null;
  try {
    const {
      BedrockAgentClient,
      CreateAgentCommand,
      CreateAgentAliasCommand,
      ListAgentsCommand,
      ListAgentAliasesCommand,
      AssociateAgentKnowledgeBaseCommand,
    } = require("@aws-sdk/client-bedrock-agent");

    const client = new BedrockAgentClient({ region });

    // Model selection with dead-model substitution
    const DEFAULT_MODEL = process.env.AWS_BEDROCK_AGENT_MODEL || "amazon.nova-lite-v1:0";
    const DEAD_MODELS = new Set([
      "anthropic.claude-3-haiku-20240307-v1:0",
      "anthropic.claude-3-sonnet-20240229-v1:0",
      "anthropic.claude-3-5-sonnet-20240620-v1:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "anthropic.claude-instant-v1",
      "anthropic.claude-v2",
      "anthropic.claude-v2:1",
    ]);
    const requestedModel = resources.foundationModels[0]?.modelId;
    const model = !requestedModel || DEAD_MODELS.has(requestedModel) ? DEFAULT_MODEL : requestedModel;
    const modelSubstituted = requestedModel && model !== requestedModel ? requestedModel : null;

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

    // Guardrails attach via guardrailConfiguration on CreateAgent
    const GUARDRAIL_ID_RE = /^([a-z0-9]+|arn:aws[a-z0-9-]*:bedrock:[a-z0-9-]{1,20}:[0-9]{12}:guardrail\/[a-z0-9]+)$/;
    const firstGuardrail = resources.guardrails[0];
    const rawGuardrailId =
      firstGuardrail?.guardrailId || firstGuardrail?.id || process.env.AWS_BEDROCK_GUARDRAIL_ID;
    const guardrailId = rawGuardrailId && GUARDRAIL_ID_RE.test(rawGuardrailId) ? rawGuardrailId : null;
    const skippedGuardrail = rawGuardrailId && !guardrailId ? rawGuardrailId : null;
    const guardrailConfiguration = guardrailId
      ? { guardrailIdentifier: guardrailId, guardrailVersion: firstGuardrail?.version || "DRAFT" }
      : undefined;

    // Idempotent: reuse existing agent with same name
    async function findAgentIdByName(name) {
      let nextToken;
      do {
        const res = await client.send(new ListAgentsCommand({ maxResults: 100, nextToken }));
        const match = (res.agentSummaries || []).find((a) => a.agentName === name);
        if (match) return match.agentId;
        nextToken = res.nextToken;
      } while (nextToken);
      return null;
    }

    let reused = false;
    const existingId = await findAgentIdByName(manifest.metadata.name);
    if (existingId) {
      reused = true;
      created = { agent: { agentId: existingId } };
    } else {
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
          ...(guardrailConfiguration ? { guardrailConfiguration } : {}),
        })
      );
    }

    const agentId = created.agent?.agentId;
    if (!agentId) {
      return { deployed: false, errors: ["CreateAgent returned no agentId"] };
    }

    // Bounded prepare wait (stay under CloudFront 30s timeout)
    let prepared = false;
    try {
      await waitForAgentPrepared(client, agentId, 7);
      prepared = true;
    } catch {
      prepared = false;
    }

    let alias = null;
    const resourceSteps = [
      reused
        ? `Reused existing agent ${agentId}`
        : prepared
          ? "PrepareAgent completed"
          : "Agent is preparing (continues in background)",
    ];
    if (modelSubstituted && !reused) resourceSteps.push(`Model "${modelSubstituted}" is legacy/unavailable — using ${model} instead`);
    if (guardrailConfiguration && !reused) resourceSteps.push(`Attached guardrail ${guardrailId}`);
    if (skippedGuardrail && !reused) {
      resourceSteps.push(`Skipped guardrail "${skippedGuardrail}" — not a valid Bedrock guardrail id/ARN.`);
    }

    // Create (or reuse) the live alias only when the agent is PREPARED
    if (prepared) {
      try {
        alias = await client.send(new CreateAgentAliasCommand({ agentId, agentAliasName: "live" }));
        resourceSteps.push("Created alias live");
      } catch (aliasErr) {
        if (/already exists|ConflictException/i.test(aliasErr.message)) {
          const al = await client.send(new ListAgentAliasesCommand({ agentId, maxResults: 20 }));
          const live = (al.agentAliasSummaries || []).find((a) => a.agentAliasName === "live");
          alias = { agentAlias: { agentAliasId: live?.agentAliasId } };
          resourceSteps.push("Reused alias live");
        } else {
          resourceSteps.push(`Alias pending: ${aliasErr.message}`);
        }
      }
    } else {
      resourceSteps.push("Alias 'live' will be created once the agent finishes preparing");
    }

    // Associate Knowledge Bases
    for (const kb of resources.knowledgeBases) {
      const kbId = kb.knowledgeBaseId || kb.id || process.env.AWS_BEDROCK_KB_ID;
      if (!kbId) continue;
      try {
        await client.send(
          new AssociateAgentKnowledgeBaseCommand({
            agentId,
            knowledgeBaseId: kbId,
            description: kb.description || "CogniMesh KB",
            knowledgeBaseState: "ENABLED",
          })
        );
        resourceSteps.push(`Associated KB ${kbId}`);
      } catch (kbErr) {
        resourceSteps.push(`KB ${kbId}: ${kbErr.message}`);
      }
    }

    return {
      deployed: true,
      simulated: false,
      agentId,
      agentArn: created.agent?.agentArn,
      aliasId: alias?.agentAlias?.agentAliasId,
      prepared,
      model,
      region,
      deployedBy: userEmail || null,
      resourceSteps,
      consoleUrl: `https://${region}.console.aws.amazon.com/bedrock/home?region=${region}#/agents/${agentId}`,
      chatUrl: null,
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
      consoleUrl: created?.agent?.agentId
        ? `https://${region}.console.aws.amazon.com/bedrock/home?region=${region}#/agents/${created.agent.agentId}`
        : null,
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
  validateAgentInstruction,
};
