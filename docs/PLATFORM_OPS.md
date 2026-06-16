# Platform Operations API

Operations layer for running and trusting CogniMesh pipelines after deploy. All routes under `/api/v1/platform/*` require auth unless noted.

Portal entry: header **Operations** panel · see [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md)

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
| `DATA_PREVIEW_LIVE=true` | S3 + local file live sampling |
| `DATA_PREVIEW_ATHENA=true` | Athena `SELECT` preview (`ATHENA_OUTPUT_LOCATION` required) |
| `DATA_PREVIEW_JDBC=true` | JDBC / RDS Data API preview |
| `DEPLOY_APPROVAL_REQUIRED=true` | Deploy queues for steward approval |
| `COPILOT_LLM_ENABLED=true` | Bedrock LLM copilot (`COPILOT_BEDROCK_MODEL_ID`) |
| `AWS_IMPORT_ENABLED=true` | Live Step Functions describe for import |
| `AWS_AGENT_DEPLOY_ENABLED=true` | Bedrock CreateAgent + KB/guardrail association |

## Data persistence (local dev)

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
- [PUBLISHING.md](PUBLISHING.md) — releases
