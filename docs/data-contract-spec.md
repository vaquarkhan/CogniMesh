# CogniMesh Data Contract Specification (Appendix A)

Version 1.0: `cognimesh.io/v1`

## Overview

A **Data Contract** is the single source of truth for a CogniMesh pipeline. The zero-code portal, pipeline engine, cognitive runtime, and marketplace all consume the same manifest.

## Top-Level Structure

```yaml
apiVersion: cognimesh.io/v1
kind: DataContract
metadata: { ... }
spec: { ... }
```

## Metadata

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Kebab-case product identifier |
| `domain` | yes | Data mesh domain |
| `version` | yes | Semver (`major.minor.patch`) |
| `description` | no | Human-readable summary |
| `owner.team` | no | Owning team |
| `owner.contact` | no | Contact email |
| `tags` | no | Key-value labels for governance |

## Spec

### `execution`

| Field | Values | Description |
|-------|--------|-------------|
| `mode` | `batch`, `stream` | Pipeline execution strategy |
| `schedule` | cron | Required for batch |
| `slaMinutes` | integer | SLA target |

### `source` (Source Block)

Maps to the portal **Source Block**. Supported types: `rds`, `mysql`, `s3`, `kafka`, `media_url`, `api`.

CDC pipelines set `cdc.enabled: true` with `primaryKey` columns.

### `transform` (Transform Block)

| Type | Use Case |
|------|----------|
| `spark_sql` | Structured Glue/EMR transforms |
| `glue_etl` | Managed Glue jobs |
| `agentic` | Cognitive AI agent jobs (EKS runtime) |
| `passthrough` | Direct landing to target |

Agentic transforms require `agentic.compensationHandler` and `agentic.idempotencyKey` for exactly-once semantics.

### `target` (Sink Block)

Destination storage: `s3`, `iceberg`, `redshift`, `delta`. Includes Glue catalog registration hints.

### `governance`

PII classification, Lake Formation row filters, and column masks applied at registration time.

## Validation

```bash
npm run validate:contract -- contracts/examples/structured-cdc-pipeline.yaml
```

Schema: [schemas/data-contract-v1.schema.json](../schemas/data-contract-v1.schema.json)
