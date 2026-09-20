# CogniMesh documentation map

Start here when you need the right doc fast. Prefer these paths over hunting the tree.

## Choose your path

| I want to… | Go here |
|------------|---------|
| **Evaluate the product** | [POSITIONING](POSITIONING.md) · [FAQ](FAQ.md) · [Top 3 features](TOP3_FEATURES.md) |
| **Run locally in 5 minutes** | [GETTING_STARTED](GETTING_STARTED.md) · [LOCAL_DEV](LOCAL_DEV.md) |
| **Walk the UI with captions** | [Tutorials hub](tutorials/README.md) · [How-to video](assets/cognimesh-howto-demo.mp4) |
| **Export SDP or dbt** | [SDP + dbt tutorial](tutorials/sdp-and-dbt.md) · [videos](tutorials/sdp-and-dbt.md#watch-captioned-ui-demos) |
| **Verify marketplace proofs** | [Proof-gated marketplace](tutorials/proof-gated-marketplace.md) · [API example](examples/proof-verify.md) |
| **Customize the portal** | [Developer hub](developer/README.md) |
| **Understand PVDM / VRP** | [Vaquar Pattern](vaquar-pattern.md) · [Data contract](data-contract-spec.md) |
| **Ship on AWS** | [aws-pvdm-runbook](examples/aws-pvdm-runbook.md) · [Terraform](../infra/terraform/README.md) |
| **Enable OpenTelemetry** | [OPENTELEMETRY.md](OPENTELEMETRY.md) |
| **Fix something broken** | [TROUBLESHOOTING](TROUBLESHOOTING.md) · [FAQ ops](FAQ.md#operations--troubleshooting) |

## Library at a glance

| Area | Count / status | Notes |
|------|----------------|-------|
| Pipeline canvases | **29** (28 wired + blank) | Architectures tab · includes SDP Medallion + dbt Silver→Gold |
| Agent templates | **8** | Agent Builder |
| Pattern tutorials | One markdown per wired pattern | Auto-generated: `npm run docs:tutorials` |
| Captioned UI demos | howto · tutorial · features · pipeline · agent · **SDP** · **dbt** · **marketplace proof** | `npm run docs:demo` |

## Documentation sets

### Product & trust

- [POSITIONING.md](POSITIONING.md) - scope, ecosystem, roadmap
- [vaquar-pattern.md](vaquar-pattern.md) - PVDM phases, N1–N20, VRP features
- [TOP3_FEATURES.md](TOP3_FEATURES.md) - honest Demo vs Opt-in AWS matrix
- [FAQ.md](FAQ.md) - repeated questions for PRs and onboarding
- [README-business-stewards.md](README-business-stewards.md) - plain language for stewards / C-suite

### Tutorials & videos

- [tutorials/README.md](tutorials/README.md) - index of all pipeline + agent lessons
- [tutorials/getting-started-ui.md](tutorials/getting-started-ui.md) - captioned portal tour
- [tutorials/sdp-and-dbt.md](tutorials/sdp-and-dbt.md) - Spark Declarative Pipelines + dbt export
- [tutorials/proof-gated-marketplace.md](tutorials/proof-gated-marketplace.md) - trust grade, verify, diff, SLA
- [PIPELINE_PATTERNS_GUIDE.md](PIPELINE_PATTERNS_GUIDE.md) - architecture pattern encyclopedia

### Developer

- [developer/README.md](developer/README.md) - customization hub + screenshot index
- [developer/CUSTOMIZE_PIPELINES.md](developer/CUSTOMIZE_PIPELINES.md) - UI walkthrough
- [developer/CUSTOMIZE_AGENTS.md](developer/CUSTOMIZE_AGENTS.md) - Agent Builder
- [developer/EXTEND_CATALOG.md](developer/EXTEND_CATALOG.md) - add patterns, APIs, exports in code
- [PORTAL_DEV.md](PORTAL_DEV.md) · [PORTAL_UI.md](PORTAL_UI.md) · [data-contract-spec.md](data-contract-spec.md)

### Examples & ops

- [examples/README.md](examples/README.md) - curl / CLI recipes
- [examples/marketplace-api.md](examples/marketplace-api.md) - trust-ranked product search API
- [examples/proof-verify.md](examples/proof-verify.md) - verify + diff proofs
- [examples/sdp-dbt-export.md](examples/sdp-dbt-export.md) - export SDP / dbt zips via API
- [examples/aws-pvdm-runbook.md](examples/aws-pvdm-runbook.md) - live AWS PVDM
- [MARKETPLACE.md](MARKETPLACE.md) - Marketplace API + high-value feature roadmap
- [OPENTELEMETRY.md](OPENTELEMETRY.md) - opt-in OTLP / console tracing
- [PLATFORM_OPS.md](PLATFORM_OPS.md) · [LINEAGE_CATALOG.md](LINEAGE_CATALOG.md) · [WELL_ARCHITECTED.md](WELL_ARCHITECTED.md)

### Architecture

- [architecture.md](architecture.md) - planes, exports, AgentCore
- [E2E_ARCHITECTURE.md](E2E_ARCHITECTURE.md) · [PIPELINE_E2E_DIAGRAM.md](PIPELINE_E2E_DIAGRAM.md)
- [drag-drop-pipeline-flow.md](drag-drop-pipeline-flow.md)

## Honesty rules (do not overclaim)

1. CogniMesh is the **control plane + JS VRP gate**, not the Python IceGuard / veridata package.
2. **SDP / dbt success ≠ catalog publish.** Iceberg commit still needs `VRP = PASS`.
3. Marketplace **samples are fail-closed** until PASS.
4. Items marked **Demo** in [TOP3_FEATURES](TOP3_FEATURES.md) work without AWS; **Opt-in AWS** need env flags + Terraform.

## Regenerate docs

```bash
npm run docs:tutorials                          # pattern/agent tutorial pages
npm run docs:demo                               # all captioned UI videos
# PowerShell subset:
$env:DEMO_ONLY='sdp-export,dbt-export,marketplace-proof'; npm run docs:demo
npm run docs:screenshots                        # portal screenshots (build portal first)
```

Root product entry: [../README.md](../README.md)
