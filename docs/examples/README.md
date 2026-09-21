# Examples

Copy-paste recipes for local API and CLI. Auth is usually off in `npm run start:dev` (`AUTH_DISABLED=true`); drop the `Authorization` header when that is set.

| Example | What it shows |
|---------|----------------|
| [marketplace-api.md](marketplace-api.md) | Trust-ranked search, featured, domains (`/api/v1/marketplace/*`) |
| [proof-verify.md](proof-verify.md) | `POST /api/v1/proofs/verify` · `POST /api/v1/proofs/diff` · fail-closed samples · SLA |
| [sdp-dbt-export.md](sdp-dbt-export.md) | Export Spark Declarative Pipelines or dbt project zips from a canvas graph |
| [aws-pvdm-runbook.md](aws-pvdm-runbook.md) | Opt-in AWS PVDM (Glue / Step Functions / proof bucket) |

## Quick start

```bash
npm run start:dev
# Portal http://localhost:3000  ·  API http://localhost:4000
```

## Prefer UI?

| Goal | Tutorial | Video |
|------|----------|-------|
| Verify / diff proofs | [Proof-gated marketplace](../tutorials/proof-gated-marketplace.md) | [marketplace-proof-demo](../assets/cognimesh-marketplace-proof-demo.mp4) |
| Export SDP / dbt | [SDP and dbt](../tutorials/sdp-and-dbt.md) | [sdp](../assets/cognimesh-sdp-export-demo.mp4) · [dbt](../assets/cognimesh-dbt-export-demo.mp4) |

Conformance fixtures for paste/CLI: `fixtures/vrp-conformance/identity-pass.json` (and `*-tampered.json`).

← [Documentation map](../README.md)
