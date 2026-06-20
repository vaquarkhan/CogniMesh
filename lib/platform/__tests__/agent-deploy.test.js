"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAgentInstruction, isAgentDeployEnabled } = require("../agent-deploy");

describe("normalizeAgentInstruction", () => {
  it("passes through instructions that already meet Bedrock minimum length", () => {
    const long = "You are a data steward responsible for schema review and access governance.";
    assert.equal(normalizeAgentInstruction(long, "steward"), long);
  });

  it("pads short or empty instructions to at least 40 characters", () => {
    assert.ok(normalizeAgentInstruction("", "orders-agent").length >= 40);
    assert.ok(normalizeAgentInstruction("Short agent.", "x").length >= 40);
    assert.match(normalizeAgentInstruction("", "orders-agent"), /orders-agent/);
  });
});

describe("isAgentDeployEnabled", () => {
  const saved = {};

  beforeEach(() => {
    saved.AWS_AGENT_DEPLOY_ENABLED = process.env.AWS_AGENT_DEPLOY_ENABLED;
    saved.AWS_BEDROCK_AGENT_ROLE_ARN = process.env.AWS_BEDROCK_AGENT_ROLE_ARN;
  });

  afterEach(() => {
    if (saved.AWS_AGENT_DEPLOY_ENABLED === undefined) delete process.env.AWS_AGENT_DEPLOY_ENABLED;
    else process.env.AWS_AGENT_DEPLOY_ENABLED = saved.AWS_AGENT_DEPLOY_ENABLED;
    if (saved.AWS_BEDROCK_AGENT_ROLE_ARN === undefined) delete process.env.AWS_BEDROCK_AGENT_ROLE_ARN;
    else process.env.AWS_BEDROCK_AGENT_ROLE_ARN = saved.AWS_BEDROCK_AGENT_ROLE_ARN;
  });

  it("auto-enables when Bedrock agent role ARN is configured", () => {
    delete process.env.AWS_AGENT_DEPLOY_ENABLED;
    process.env.AWS_BEDROCK_AGENT_ROLE_ARN = "arn:aws:iam::123456789012:role/bedrock-agent";
    assert.equal(isAgentDeployEnabled(), true);
  });

  it("respects explicit AWS_AGENT_DEPLOY_ENABLED=false", () => {
    process.env.AWS_AGENT_DEPLOY_ENABLED = "false";
    process.env.AWS_BEDROCK_AGENT_ROLE_ARN = "arn:aws:iam::123456789012:role/bedrock-agent";
    assert.equal(isAgentDeployEnabled(), false);
  });

  it("is disabled when no flag and no role ARN", () => {
    delete process.env.AWS_AGENT_DEPLOY_ENABLED;
    delete process.env.AWS_BEDROCK_AGENT_ROLE_ARN;
    assert.equal(isAgentDeployEnabled(), false);
  });
});
