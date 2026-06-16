# CogniMesh Platform Review

**Date:** June 2026  
**Scope:** Deployed pipeline path, Agent Builder, Terraform prod, local dev stack  
**AWS state:** Clean (all local services stopped)

## Verdict

**3 bugs found and fixed during this review. Zero bugs remaining in the deployed pipeline path.**

| # | Bug | Fix |
|---|-----|-----|
| 1 | Duplicate `aws_region` in prod Terraform (`providers.tf` + `variables.tf`) | Removed from `providers.tf` (`47af5f2`) |
| 2 | Lambda zip missing `node_modules` / wrong function names | `package-lambda.js`, domain-writer `package.json`, `function_suffix` (`f660887`) |
| 3 | Agent export YAML `environmentVariables:` with empty object | Omit when no guardrails; `manifestToYaml` emits `{}` for empty maps |

Pipeline deploy (integrity gate → catalog → Step Functions) is **production-ready**. Agent Builder is **design + manifest export only** (Bedrock Agent API deploy is a feature boundary, not a bug).

## Path to 10/10

| Item | Status | Notes |
|------|--------|-------|
| Agent export empty-object YAML | Done | `portal/src/lib/agent-export.js` |
| Full CI (all jobs green) | Done | Lint fix, `terraform fmt`, Node in terraform job |
| Portal unit tests | Done | 33+ vitest tests in `portal/src/lib/*.test.js` |
| Vitest wired in postinstall | Done | `scripts/postinstall.js` verifies vitest; runs tests in CI |

## Enterprise tier (~3-4 months, $100K/year positioning)

| Capability | Description |
|------------|-------------|
| **Health Score** | Pipeline/agent readiness score from validation, AWS design review, and runtime signals |
| **Impact Analysis** | Blast radius before deploy (schema change, downstream consumers, LF grants) |
| **Cost Attribution** | Per-pipeline AWS cost tags (Glue, SFN, S3, Bedrock) in marketplace |
| **Natural Language pipeline creation** | AI Builder already local; extend to full contract + deploy confirmation |

## Commands (verification)

```bash
npm run start:dev
npm run test:unit
npm run test:portal-unit
npm run test:lambda-zips
npm test
cd infra/terraform/environments/prod && terraform validate
```

## Related docs

- [PLATFORM_CHECKLIST.md](docs/PLATFORM_CHECKLIST.md) - tracker
- [AGENT_BUILDER.md](docs/AGENT_BUILDER.md) - agent design vs AWS deploy boundary
- [PUBLISHING.md](docs/PUBLISHING.md) - GHCR + PyPI
