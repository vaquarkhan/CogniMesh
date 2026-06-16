#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { compileVaquarStateMachine } = require("../pvdm-sfn");

describe("pvdm-sfn", () => {
  const contract = {
    metadata: { name: "orders", version: "1.0.0", domain: "commerce" },
    spec: { transform: { type: "spark_sql" } },
  };

  it("uses real account id in domain writer ARN when provided", () => {
    const sm = compileVaquarStateMachine(contract, {
      accountId: "999888777666",
      region: "eu-west-1",
      namePrefix: "cognimesh-dev",
    });
    const fn = sm.States.InvokeDomainWriter.Parameters.FunctionName;
    assert.match(fn, /arn:aws:lambda:eu-west-1:999888777666:function:cognimesh-dev-domain-writer:live/);
  });

  it("uses INTEGRITY_GATE_FUNCTION env-style name", () => {
    const sm = compileVaquarStateMachine(contract, { namePrefix: "cognimesh-dev" });
    assert.equal(sm.States.IntegrityGate.Parameters.FunctionName, "cognimesh-dev-integrity-gate");
  });
});
