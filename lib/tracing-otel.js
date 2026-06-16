"use strict";

/**
 * OpenTelemetry Node SDK bootstrap for the API gateway.
 * Enable with OTEL_SDK_ENABLED=true and/or OTEL_EXPORTER_OTLP_ENDPOINT.
 * Disable entirely with OTEL_SDK_DISABLED=true (used in unit tests).
 */

let sdk = null;

function initOtel() {
  if (sdk || process.env.OTEL_SDK_DISABLED === "true") {
    return { enabled: false };
  }

  const enabled =
    process.env.OTEL_SDK_ENABLED === "true" || Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  if (!enabled) {
    return { enabled: false };
  }

  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const { Resource } = require("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = require("@opentelemetry/semantic-conventions");

  const config = {
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "cognimesh-api-gateway",
    }),
    instrumentations: [],
  };

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "");
    config.traceExporter = new OTLPTraceExporter({ url: `${base}/v1/traces` });
  } else if (process.env.OTEL_TRACES_EXPORTER === "console") {
    const { ConsoleSpanExporter } = require("@opentelemetry/sdk-trace-base");
    config.traceExporter = new ConsoleSpanExporter();
  }

  try {
    const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
    const { ExpressInstrumentation } = require("@opentelemetry/instrumentation-express");
    config.instrumentations = [
      new HttpInstrumentation(),
      new ExpressInstrumentation({ ignoreLayersType: [] }),
    ];
  } catch {
    /* instrumentation packages optional at runtime */
  }

  sdk = new NodeSDK(config);
  sdk.start();

  const shutdown = () => {
    sdk?.shutdown().catch(() => {});
  };
  process.once("SIGTERM", shutdown);
  process.once("beforeExit", shutdown);

  return { enabled: true };
}

function isOtelEnabled() {
  return Boolean(sdk);
}

module.exports = { initOtel, isOtelEnabled };
