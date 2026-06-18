"use strict";

const {
  SFNClient,
  CreateStateMachineCommand,
  UpdateStateMachineCommand,
  ListStateMachinesCommand,
  StartExecutionCommand,
} = require("@aws-sdk/client-sfn");

function isAwsDeployEnabled() {
  return process.env.AWS_DEPLOY_ENABLED === "true";
}

function stateMachineName(pipelineId) {
  const prefix = process.env.AWS_NAME_PREFIX || "cognimesh";
  return `${prefix}-${pipelineId}`.slice(0, 80);
}

/** Remove CogniMesh metadata keys — AWS Step Functions rejects unknown top-level ASL fields. */
function sanitizeStateMachineForAws(definition) {
  if (definition == null || typeof definition !== "object") return definition;
  if (Array.isArray(definition)) {
    return definition.map(sanitizeStateMachineForAws);
  }
  const out = {};
  for (const [key, value] of Object.entries(definition)) {
    if (key === "cognimesh") continue;
    out[key] = sanitizeStateMachineForAws(value);
  }
  return out;
}

async function findStateMachineArn(client, name) {
  let nextToken;
  do {
    const res = await client.send(new ListStateMachinesCommand({ nextToken }));
    const match = (res.stateMachines || []).find((sm) => sm.name === name);
    if (match) return match.stateMachineArn;
    nextToken = res.nextToken;
  } while (nextToken);
  return null;
}

async function deployStateMachine(contract, stateMachineDefinition, options = {}) {
  const deployRegion =
    options.region ||
    contract.metadata?.awsRegion ||
    contract.spec?.deployment?.region ||
    process.env.AWS_REGION ||
    "us-east-1";
  if (!isAwsDeployEnabled()) {
    return {
      deployed: false,
      reason:
        "Step Functions not pushed to AWS. Set AWS_DEPLOY_ENABLED=true and AWS_STEP_FUNCTIONS_ROLE_ARN in the API server .env (terraform output pipeline_orchestrator_role_arn).",
      hint: "terraform -chdir=infra/terraform/environments/dev output -raw pipeline_orchestrator_role_arn",
    };
  }

  if (!process.env.AWS_STEP_FUNCTIONS_ROLE_ARN) {
    return {
      deployed: false,
      error: "AWS_STEP_FUNCTIONS_ROLE_ARN is required when AWS_DEPLOY_ENABLED=true",
      reason:
        "AWS deploy is enabled but AWS_STEP_FUNCTIONS_ROLE_ARN is missing — Step Functions state machine was not created.",
      hint: "terraform -chdir=infra/terraform/environments/dev output -raw pipeline_orchestrator_role_arn",
    };
  }

  const client = new SFNClient({ region: deployRegion });
  const name = stateMachineName(contract.metadata.name);
  const definition = JSON.stringify(sanitizeStateMachineForAws(stateMachineDefinition));
  const roleArn = process.env.AWS_STEP_FUNCTIONS_ROLE_ARN;
  const existingArn = await findStateMachineArn(client, name);

  let stateMachineArn;
  if (existingArn) {
    const updated = await client.send(
      new UpdateStateMachineCommand({
        stateMachineArn: existingArn,
        definition,
        roleArn,
      })
    );
    stateMachineArn = updated.stateMachineArn || existingArn;
  } else {
    const created = await client.send(
      new CreateStateMachineCommand({
        name,
        definition,
        roleArn,
        type: "STANDARD",
        tags: [
          { key: "Project", value: "cognimesh" },
          { key: "Domain", value: contract.metadata.domain },
          { key: "PipelineId", value: contract.metadata.name },
        ],
      })
    );
    stateMachineArn = created.stateMachineArn;
  }

  let execution = null;
  if (process.env.AWS_DEPLOY_EXECUTE === "true") {
    const started = await client.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: `${contract.metadata.name}-${Date.now()}`,
        input: JSON.stringify({ contract: contract.metadata }),
      })
    );
    execution = {
      executionArn: started.executionArn,
      startDate: started.startDate,
    };
  }

  return {
    deployed: true,
    stateMachineArn,
    stateMachineName: name,
    execution,
  };
}

module.exports = { deployStateMachine, isAwsDeployEnabled, sanitizeStateMachineForAws };
