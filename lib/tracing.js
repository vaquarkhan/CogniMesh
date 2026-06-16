"use strict";

/**
 * Tracing facade — structured span logs plus OpenTelemetry SDK when enabled.
 * Set OTEL_SDK_ENABLED=true and OTEL_EXPORTER_OTLP_ENDPOINT for OTLP export.
 */

const { isOtelEnabled } = require("./tracing-otel");

function log(event, payload) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "cognimesh-trace",
      event,
      ...payload,
    })
  );
}

function newTraceId() {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSpanId() {
  return `sp-${Math.random().toString(36).slice(2, 10)}`;
}

function traceId() {
  return process.env.TRACE_ID || newTraceId();
}

function getTracer() {
  if (!isOtelEnabled()) return null;
  const api = require("@opentelemetry/api");
  return api.trace.getTracer("cognimesh", process.env.npm_package_version || "1.0.0");
}

function startLegacySpan(name, attributes, parentSpan) {
  const id = parentSpan?.traceId || traceId();
  const spanId = newSpanId();
  const parentSpanId = parentSpan?.spanId || attributes.parent_span_id || null;
  const start = Date.now();
  return {
    traceId: id,
    spanId,
    parentSpanId,
    name,
    _otelSpan: null,
    end(outcome = "ok", extra = {}) {
      const duration_ms = Date.now() - start;
      const payload = {
        trace_id: id,
        span_id: spanId,
        parent_span_id: parentSpanId,
        span: name,
        outcome,
        duration_ms,
        ...attributes,
        ...extra,
      };
      log("trace_span", payload);
      return payload;
    },
  };
}

function startOtelSpan(name, attributes, parentSpan) {
  const api = require("@opentelemetry/api");
  const tracer = getTracer();
  const parentContext = parentSpan?._otelSpan
    ? api.trace.setSpan(api.context.active(), parentSpan._otelSpan)
    : api.context.active();

  const otelSpan = tracer.startSpan(name, { attributes: stringifyAttrs(attributes) }, parentContext);
  const ctx = api.trace.setSpan(parentContext, otelSpan);
  const { traceId: tid, spanId: sid } = otelSpan.spanContext();
  const parentSpanId = parentSpan?.spanId || attributes.parent_span_id || null;
  const start = Date.now();

  return {
    traceId: tid,
    spanId: sid,
    parentSpanId,
    name,
    _otelSpan: otelSpan,
    _otelContext: ctx,
    end(outcome = "ok", extra = {}) {
      const duration_ms = Date.now() - start;
      for (const [k, v] of Object.entries({ ...extra })) {
        if (v != null) otelSpan.setAttribute(k, String(v));
      }
      otelSpan.setAttribute("outcome", outcome);
      if (outcome === "error" || outcome === "failure") {
        otelSpan.setStatus({ code: api.SpanStatusCode.ERROR });
      } else {
        otelSpan.setStatus({ code: api.SpanStatusCode.OK });
      }
      otelSpan.end();
      const payload = {
        trace_id: tid,
        span_id: sid,
        parent_span_id: parentSpanId,
        span: name,
        outcome,
        duration_ms,
        ...attributes,
        ...extra,
      };
      log("trace_span", payload);
      return payload;
    },
  };
}

function stringifyAttrs(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

/** @param {object} [parentSpan] - parent from startSpan() for distributed trace propagation */
function startSpan(name, attributes = {}, parentSpan = null) {
  if (isOtelEnabled()) {
    return startOtelSpan(name, attributes, parentSpan);
  }
  return startLegacySpan(name, attributes, parentSpan);
}

module.exports = { startSpan, traceId, isOtelEnabled };
