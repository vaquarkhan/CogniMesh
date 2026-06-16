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

Portal dev server runs on **http://localhost:3000** (see `portal/vite.config.js`). The API loads `.env` from the repo root.

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

Local deploy compiles contracts and runs PVDM simulation without AWS. For real Step Functions / Bedrock deploy, set variables from `.env.example` after `terraform apply` in `infra/terraform/environments/prod` or `dev`.

## Questions

Open a [GitHub issue](https://github.com/vaquarkhan/CogniMesh/issues) for bugs or feature requests.
