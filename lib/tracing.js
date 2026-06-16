"use strict";

/**
 * Lightweight tracing - structured span logs + optional OTLP HTTP export.
 * Set OTEL_EXPORTER_OTLP_ENDPOINT to forward spans (e.g. Jaeger/Tempo collector).
 */

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

/** @param {object} [parentSpan] - parent from startSpan() for distributed trace propagation */
function startSpan(name, attributes = {}, parentSpan = null) {
  const id = parentSpan?.traceId || traceId();
  const spanId = newSpanId();
  const parentSpanId = parentSpan?.spanId || attributes.parent_span_id || null;
  const start = Date.now();
  return {
    traceId: id,
    spanId,
    parentSpanId,
    name,
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
      exportOtlp(payload).catch(() => {});
      return payload;
    },
  };
}

async function exportOtlp(payload) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;
  const url = `${endpoint.replace(/\/$/, "")}/v1/traces`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  name: payload.span,
                  attributes: Object.entries(payload).map(([k, v]) => ({
                    key: k,
                    value: { stringValue: String(v) },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(3000),
  });
}

module.exports = { startSpan, traceId };
