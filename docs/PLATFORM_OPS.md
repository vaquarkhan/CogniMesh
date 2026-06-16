# Platform Operations API

Operations layer for running and trusting CogniMesh pipelines after deploy. All routes under `/api/v1/platform/*` require auth unless noted.

Portal entry: header **Operations** panel

## Quick reference

| Area | Method | Path |
|------|--------|------|
| Live dashboard | GET | `/api/v1/platform/dashboard` |
| Health scores | GET | `/api/v1/platform/health?domain=` |
| Deploy impact | POST | `/api/v1/platform/impact` |
| Source preview | POST | `/api/v1/platform/preview-source` |
| Versions | GET | `/api/v1/platform/versions/{domain}/{name}` |
| Version diff | GET | `/api/v1/platform/versions/diff?leftId=&rightId=` |
| Rollback | GET | `/api/v1/platform/versions/rollback/{versionId}` |
| Costs | GET | `/api/v1/platform/costs` |
| Audit report | GET | `/api/v1/platform/audit-report?format=json\|markdown\|html` |
| Column lineage | POST | `/api/v1/platform/column-lineage` |
| Self-heal | POST | `/api/v1/platform/self-heal/pipeline` |
| Deploy approvals | GET | `/api/v1/platform/deploy-approvals` |
| Billing | GET | `/api/v1/platform/billing` |
| Plugins | GET/POST | `/api/v1/platform/plugins` |
| Plugin sandbox | POST | `/api/v1/platform/plugins/sandbox` |
| Copilot | POST | `/api/v1/platform/copilot` |
| Import SFN | POST | `/api/v1/platform/import/sfn` |
| Import Glue | POST | `/api/v1/platform/import/glue` |
| Open spec | GET | `/api/v1/platform/open-spec` |
| Spec site (public) | GET | `/api/v1/platform/open-spec/site` |
| Agent deploy | POST | `/api/v1/agents/deploy` |

## Environment flags

| Flag | Effect |
|------|--------|
| `DATA_PREVIEW_LIVE=true` | S3 + local file live sampling (see walkthrough below) |
| `DATA_PREVIEW_ATHENA=true` | Athena `SELECT` preview (`ATHENA_OUTPUT_LOCATION` required) |
| `DATA_PREVIEW_JDBC=true` | JDBC / RDS Data API preview |
| `DEPLOY_APPROVAL_REQUIRED=true` | Deploy queues for steward approval (Steward → **Approvals** panel) |
| `AWS_DEPLOY_ENABLED=true` | Create/update Step Functions on deploy (`AWS_STEP_FUNCTIONS_ROLE_ARN` required) |
| `COPILOT_LLM_ENABLED=true` | Bedrock LLM copilot (`COPILOT_BEDROCK_MODEL_ID`) |
| `AWS_IMPORT_ENABLED=true` | Live Step Functions describe for import |
| `AWS_AGENT_DEPLOY_ENABLED=true` | Bedrock CreateAgent + KB/guardrail association |

## Source preview walkthrough

`POST /api/v1/platform/preview-source` compiles the canvas graph, then samples up to 10 rows from the **source** block in the contract.

1. Add or load a pipeline with a **source** block (S3, RDS, or local file).
2. On the source block properties, set connection fields that map to the contract:
   - **S3:** `endpoint` → `s3://your-bucket/prefix/` (trailing slash optional)
   - **Local file:** `endpoint` → `file:///path/to/sample.parquet` or `.csv`
   - **RDS / JDBC:** `secretArn`, `database`, `table` (enable `DATA_PREVIEW_JDBC=true` or use an RDS source type)
   - **Athena:** `database`, `table` with `DATA_PREVIEW_ATHENA=true` and `ATHENA_OUTPUT_LOCATION=s3://bucket/athena-results/`
3. Set server env and restart the API (`npm run dev:api`):
   ```bash
   DATA_PREVIEW_LIVE=true
   AWS_REGION=us-east-1
   # plus Athena/JDBC vars when needed
   ```
4. In the portal **Properties** panel, click **Preview source data (10 rows)**. A green **Live data** badge means rows came from AWS or disk; **Sample data** means simulated rows (flag off or unsupported connector).

**IAM (live paths):** S3 read on the source prefix; Athena `StartQueryExecution` + results bucket write; RDS Data API `ExecuteStatement` on the cluster + `secretsmanager:GetSecretValue` for the secret.

Kafka and Kinesis sources always return simulated samples until a live connector is added.

## Data persistence (local dev)

Local JSON under `data/` (gitignored) when `PLATFORM_STORE` is not `dynamodb`:

| File | Contents |
|------|----------|
| `data/pipeline-versions.json` | Deploy version snapshots |
| `data/deploy-approvals.json` | Pending deploy approvals |
| `data/plugins.json` | Custom plugin registry |
| `data/cross-org-billing.json` | Federated billing events |

## Health check

`GET /health` includes `checks.platform_ops` with pipeline count and feature list.

## Open specification

- JSON Schema: `/schemas/data-contract-v1.schema.json`
- HTML site: `/api/v1/platform/open-spec/site`
- Agent spec: `agentcore.cognimesh/v1` (see [AGENT_BUILDER.md](AGENT_BUILDER.md))

## Related

- [openapi.yaml](openapi.yaml) — full API reference
- [PORTAL_DEV.md](PORTAL_DEV.md) — local development
