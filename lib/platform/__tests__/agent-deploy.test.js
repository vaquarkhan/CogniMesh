"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAgentInstruction } = require("../agent-deploy");

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
