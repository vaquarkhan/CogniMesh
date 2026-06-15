"use strict";

/**
 * Lightweight tracing — structured span logs + optional OTLP HTTP export.
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

function traceId() {
  return process.env.TRACE_ID || `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function startSpan(name, attributes = {}) {
  const id = traceId();
  const start = Date.now();
  return {
    traceId: id,
    name,
    end(outcome = "ok", extra = {}) {
      const duration_ms = Date.now() - start;
      const payload = {
        trace_id: id,
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
