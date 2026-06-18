#!/usr/bin/env node
"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("metrics-emf", () => {
  const envBackup = { ...process.env };
  let logs;

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.NODE_ENV = "production";
    logs = [];
    console.log = (...args) => logs.push(args.join(" "));
    delete require.cache[require.resolve("../metrics-emf")];
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("emits EMF JSON when enabled in production", () => {
    const { incEmf } = require("../metrics-emf");
    incEmf("deploy_success", 1);
    assert.equal(logs.length, 1);
    const payload = JSON.parse(logs[0]);
    assert.equal(payload._aws.CloudWatchMetrics[0].Namespace, "CogniMesh");
    assert.equal(payload.deploy_success, 1);
  });

  it("skips EMF when disabled", () => {
    process.env.ENABLE_EMF_METRICS = "false";
    delete require.cache[require.resolve("../metrics-emf")];
    const { incEmf } = require("../metrics-emf");
    incEmf("deploy_success", 1);
    assert.equal(logs.length, 0);
  });
});
