# OpenTelemetry (OTel)

CogniMesh API gateway can export distributed traces via the OpenTelemetry Node SDK.

## Status

| Mode | How | What you get |
|------|-----|----------------|
| **Off (default)** | no env | Structured JSON span logs only (`cognimesh-trace`) |
| **Console** | `OTEL_SDK_ENABLED=true` + `OTEL_TRACES_EXPORTER=console` | Spans printed to stdout |
| **OTLP HTTP** | `OTEL_SDK_ENABLED=true` + `OTEL_EXPORTER_OTLP_ENDPOINT` | Export to collector (Jaeger, Grafana Tempo, ADOT, …) |

`GET /health` reports `otel.enabled`, `otel.exporter`, and a setup `hint` when tracing is off.

## Enable locally

```bash
# .env
OTEL_SDK_ENABLED=true
OTEL_SERVICE_NAME=cognimesh-api-gateway
OTEL_TRACES_EXPORTER=console
# or:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

```bash
npm run start:dev
curl -s http://localhost:4000/health | jq .otel
```

Expect `enabled: true` after the process starts with those vars.

## Spans CogniMesh emits

| Span | When |
|------|------|
| `api.preview` / `compile.preview` | Preview YAML |
| `api.deploy` / `compile.deploy` | Deploy |
| `api.export.sdp` / `api.export.dbt` | SDP / dbt zip export |
| `api.proofs.verify` / `api.proofs.diff` | Marketplace proof tools |

HTTP and Express auto-instrumentation attach when the SDK is enabled (`lib/tracing-otel.js`).

## Disable in tests

```bash
OTEL_SDK_DISABLED=true
```

Unit tests set this so the SDK never starts during `node --test`.

## Code

- Bootstrap: `lib/tracing-otel.js` (called first in `services/api-gateway/server.js`)
- Facade: `lib/tracing.js` → `startSpan(name, attrs, parent?)`
- Env template: `.env.example` (Observability section)

## Collector tip

OTLP HTTP default path is `{endpoint}/v1/traces`. Example with Jaeger all-in-one:

```bash
docker run -p 4318:4318 -p 16686:16686 jaegertracing/all-in-one:1.57
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Then open http://localhost:16686 and filter service `cognimesh-api-gateway`.

← [Documentation map](README.md) · [LOCAL_DEV](LOCAL_DEV.md)
