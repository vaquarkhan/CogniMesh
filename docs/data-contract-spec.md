# CogniMesh Data Contract Specification

Version 1.0: `cognimesh.io/v1`

This is the **CogniMesh pipeline contract** schema (portal → compiler → runtime). It is not Appendix A of [arXiv:2608.14643](https://arxiv.org/abs/2608.14643). Paper Appendix A is the **typed canonicalization** used when hashing VRP rows (`lib/vrp/canonical.js`).

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

### `transform.pvdm` (proof-gated publish)

When `spec.execution.pattern` is `vaquar` or `spec.transform.pvdm` is set, catalog commit is gated on VRP PASS.

```yaml
spec:
  transform:
    pvdm:
      identityFields: [payment_id]
      contentFields: [payment_id, amount]
      sourceSnapshotId: "glue:orders@123456789"
      fieldTypes:
        amount: { type: decimal, scale: 2 }
        event_ts: { type: timestamp }
      vrp:
        mode: identity          # identity | aggregate
        profile: A              # A | O | T
        sequenceField: event_seq  # required for Profile O (paper N9)
        producerAttestorId: steward-spark
        independentAttestorId: steward-duckdb
        producerArtifactDigest: sha256:aaa
        independentArtifactDigest: sha256:bbb
```

See [Proof-gated marketplace tutorial](tutorials/proof-gated-marketplace.md) and [Vaquar Pattern](vaquar-pattern.md).

### `transform.type`: `spark_declarative` and `dbt`

| Type | Export | Runtime |
|------|--------|---------|
| `spark_declarative` | `POST /api/v1/pipelines/export/spark-declarative` | `spark-pipelines run` (Spark 4.1+) |
| `dbt` | `POST /api/v1/pipelines/export/dbt` | `dbt run` / `dbt test` |

Both keep `transform.pvdm` so CogniMesh can proof-gate Iceberg publish after the external engine succeeds. Tutorial: [SDP and dbt](tutorials/sdp-and-dbt.md).

### `target` (Sink Block)

Destination storage: `s3`, `iceberg`, `redshift`, `delta`. Includes Glue catalog registration hints.

### `governance`

PII classification, Lake Formation row filters, and column masks applied at registration time.

## Validation

```bash
npm run validate:contract -- contracts/examples/structured-cdc-pipeline.yaml
```

Schema: [schemas/data-contract-v1.schema.json](../schemas/data-contract-v1.schema.json)
