#!/usr/bin/env node
"use strict";

process.env.OTEL_SDK_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { startSpan } = require("../tracing");
const { alertDeployFailure } = require("../alerting");

describe("tracing", () => {
  it("startSpan returns traceId and ends with outcome", () => {
    const span = startSpan("test.op", { foo: "bar" });
    assert.ok(span.traceId);
    assert.ok(span.spanId);
    const ended = span.end("ok");
    assert.equal(ended.outcome, "ok");
    assert.equal(ended.span, "test.op");
    assert.equal(ended.parent_span_id, null);
  });

  it("child span shares trace_id and sets parent_span_id", () => {
    const parent = startSpan("api.preview", { user_id: "u1" });
    const child = startSpan("compile.preview", { user_id: "u1" }, parent);
    assert.equal(child.traceId, parent.traceId);
    assert.notEqual(child.spanId, parent.spanId);
    const ended = child.end("ok");
    assert.equal(ended.trace_id, parent.traceId);
    assert.equal(ended.parent_span_id, parent.spanId);
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
