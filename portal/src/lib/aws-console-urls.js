/** AWS Console deep links for portal deploy banners. */

export function parseAwsArn(arn) {
  if (!arn || typeof arn !== "string") return null;
  const parts = arn.split(":");
  if (parts.length < 6) return null;
  return { region: parts[3], service: parts[2], resource: parts.slice(5).join(":") };
}

export function bedrockAgentConsoleUrl(agentArn) {
  const parsed = parseAwsArn(agentArn);
  if (!parsed || parsed.service !== "bedrock") return null;
  const agentId = parsed.resource.replace(/^agent\//, "");
  return `https://${parsed.region}.console.aws.amazon.com/bedrock/home?region=${parsed.region}#/agents/${agentId}`;
}

export function stepFunctionsStateMachineConsoleUrl(stateMachineArn) {
  const parsed = parseAwsArn(stateMachineArn);
  if (!parsed || parsed.service !== "states") return null;
  return `https://${parsed.region}.console.aws.amazon.com/states/home?region=${parsed.region}#/statemachines/view/${encodeURIComponent(stateMachineArn)}`;
}
