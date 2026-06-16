# Contributing to CogniMesh

Thanks for your interest in CogniMesh. This guide covers local setup, tests, and how to send changes.

## Prerequisites

- **Node.js 20+** and npm
- **Python 3.11+** (for `python/` SDK tests)
- **Java 17+** and Maven (optional — catalog service; use `CATALOG_STORAGE=memory` for API-only dev)
- **Go 1.22+** (optional — cognitive runtime)
- **Docker** (optional — full stack via `docker compose`)

## Quick start

```bash
git clone https://github.com/vaquarkhan/CogniMesh.git
cd CogniMesh
cp .env.example .env
npm ci
npm run dev:minimal    # API :4000 + portal :3000
```

Portal dev server runs on **http://localhost:3000** (see `portal/vite.config.js`). The API loads `.env` from the repo root; if `.env` is missing it falls back to `.env.example`.

## Running tests

```bash
npm run test:unit           # Node unit tests (lib, API gateway, platform)
npm run test:portal-unit    # Portal vitest
npm run test:portal-e2e     # Playwright (Operations + Approvals)
npm test                    # Offline integration tests
python -m pytest python/tests -q
```

## Lint and format

```bash
npm run lint
npm run format:check
```

## Project layout

| Path | Purpose |
|------|---------|
| `portal/` | React zero-code designer |
| `services/api-gateway/` | Express API |
| `lib/` | Contract compiler, platform ops, Vaquar runtime |
| `infra/terraform/` | AWS infrastructure |
| `python/` | PyPI SDK (`cognimesh`) |
| `docs/` | User-facing documentation |

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; match existing code style.
3. Run `npm run test:unit` and `npm run test:portal-unit` before opening a PR.
4. Describe **what** and **why** in the PR body; include test plan steps.

## AWS deploy (optional)

Local deploy compiles contracts and runs PVDM simulation without AWS. For real Step Functions / Bedrock deploy:

```bash
cd infra/terraform/environments/dev
terraform apply
```

### One-command env cheat sheet

Copy all deploy-related variables into your shell (PowerShell example):

```powershell
cd infra/terraform/environments/dev
$env = terraform output -json aws_deploy_env | ConvertFrom-Json
$plat = terraform output -json platform_env | ConvertFrom-Json
$env.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }
$plat.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }
```

Bash:

```bash
cd infra/terraform/environments/dev
terraform output -json aws_deploy_env | jq -r 'to_entries[] | "\(.key)=\(.value)"'
terraform output -json platform_env | jq -r 'to_entries[] | "\(.key)=\(.value)"'
```

Individual outputs:

| Output | Use in `.env` |
|--------|----------------|
| `pipeline_orchestrator_role_arn` | `AWS_STEP_FUNCTIONS_ROLE_ARN` |
| `bedrock_agent_role_arn` | `AWS_BEDROCK_AGENT_ROLE_ARN` |
| `aws_deploy_env` (JSON) | Step Functions, buckets, Lambda names |
| `platform_env` (JSON) | Bedrock, Athena, DynamoDB ops |

Copy values into `.env`, set `AWS_DEPLOY_ENABLED=true` and `AWS_AGENT_DEPLOY_ENABLED=true`, restart `npm run dev:api`. Without `AWS_STEP_FUNCTIONS_ROLE_ARN`, deploy succeeds locally but the portal shows an explicit warning that SFN was not pushed.

**Live source preview:** set `DATA_PREVIEW_LIVE=true` on the API server (see `docs/PLATFORM_OPS.md`).

## Questions

Open a [GitHub issue](https://github.com/vaquarkhan/CogniMesh/issues) for bugs or feature requests.
