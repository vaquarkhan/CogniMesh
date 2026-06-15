#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { startSpan } = require("../tracing");
const { alertDeployFailure } = require("../alerting");

describe("tracing", () => {
  it("startSpan returns traceId and ends with outcome", () => {
    const span = startSpan("test.op", { foo: "bar" });
    assert.ok(span.traceId);
    const ended = span.end("ok");
    assert.equal(ended.outcome, "ok");
    assert.equal(ended.span, "test.op");
  });
});

describe("alerting", () => {
  it("skips when ALERT_WEBHOOK_URL unset", async () => {
    const prev = process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_URL;
    const r = await alertDeployFailure({ pipelineName: "x", errors: ["e"] });
    assert.equal(r.sent, false);
    if (prev) process.env.ALERT_WEBHOOK_URL = prev;
  });
});
