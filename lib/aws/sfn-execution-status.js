"use strict";

const {
  SFNClient,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
} = require("@aws-sdk/client-sfn");

function awsConsoleExecutionUrl(executionArn, region) {
  if (!executionArn) return null;
  const r = region || process.env.AWS_REGION || "us-east-1";
  return `https://${r}.console.aws.amazon.com/states/home?region=${r}#/executions/details/${encodeURIComponent(executionArn)}`;
}

function awsConsoleStateMachineUrl(stateMachineArn, region) {
  if (!stateMachineArn) return null;
  const r = region || process.env.AWS_REGION || "us-east-1";
  return `https://${r}.console.aws.amazon.com/states/home?region=${r}#/statemachines/view/${encodeURIComponent(stateMachineArn)}`;
}

async function getExecutionStatus(executionArn) {
  if (!executionArn) {
    return { status: "unknown", error: "No execution ARN" };
  }
  if (process.env.AWS_DEPLOY_ENABLED !== "true") {
    return {
      status: "local",
      message: "AWS deploy disabled — showing compiled state machine only",
      consoleUrl: null,
    };
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const client = new SFNClient({ region });
  try {
    const res = await client.send(new DescribeExecutionCommand({ executionArn }));
    return {
      status: res.status,
      startDate: res.startDate,
      stopDate: res.stopDate,
      executionArn: res.executionArn,
      stateMachineArn: res.stateMachineArn,
      consoleUrl: awsConsoleExecutionUrl(executionArn, region),
      stateMachineConsoleUrl: awsConsoleStateMachineUrl(res.stateMachineArn, region),
    };
  } catch (err) {
    return { status: "error", error: err.message, executionArn };
  }
}

async function getExecutionHistorySummary(executionArn, max = 5) {
  if (!executionArn || process.env.AWS_DEPLOY_ENABLED !== "true") return { events: [] };
  const client = new SFNClient({ region: process.env.AWS_REGION || "us-east-1" });
  const res = await client.send(
    new GetExecutionHistoryCommand({ executionArn, maxResults: max, reverseOrder: true })
  );
  return {
    events: (res.events || []).map((e) => ({
      id: e.id,
      type: e.type,
      timestamp: e.timestamp,
      stateName: e.stateEnteredEventDetails?.name || e.stateExitedEventDetails?.name,
    })),
  };
}

module.exports = {
  getExecutionStatus,
  getExecutionHistorySummary,
  awsConsoleExecutionUrl,
  awsConsoleStateMachineUrl,
};
