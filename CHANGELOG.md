# Changelog

All notable changes to CogniMesh are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — `ui-enhancement` branch

- **Dynamic draw.io export**: Architecture diagram reads actual canvas nodes — only shows RDS, Kinesis, Glue, Firehose, Integrity Gate, etc. when those blocks exist on the pipeline canvas
- **VPC provisioning mode**: Choose between Terraform-managed VPC or reference an existing VPC (affects Terraform export and draw.io diagrams)
- **Streamlit agent chat UI**: Auto-launches a Streamlit chat interface after deploying a Bedrock Agent from the Agent Builder panel
- **Amazon Q fix integration**: Design Review findings can invoke Amazon Q Business to generate step-by-step remediation guides
- **Canvas-aware IAM/Security Groups**: IAM roles and security groups in draw.io diagrams are scoped to only the services present on the canvas
- **Edge-case handling**: Empty canvas → minimal diagram; sink-only pipelines don't crash; always produces valid XML
- Tutorial: [TUTORIAL_AGENT_DEPLOY.md](docs/TUTORIAL_AGENT_DEPLOY.md) — deploying an agent with Streamlit chat
- Tutorial: [TUTORIAL_DRAWIO_EXPORT.md](docs/TUTORIAL_DRAWIO_EXPORT.md) — exporting architecture diagrams

### Changed

- `generateDrawioArchitecture` now returns `serviceCount` reflecting actual dynamic services (no longer hardcoded +10 offset)
- Architecture docs updated with VPC mode, Streamlit chat, Amazon Q, and dynamic export sections

## [1.0.0] - 2026-06-16

### Added

- Stable 1.0 release: platform operations, DynamoDB store, Terraform `platform-ops`, portal E2E tests
- PyPI trusted-publisher workflow with API-token fallback

### Changed

- Docker publish fixes catalog image path in CI
- CI: npm install retries, Terraform formatting

[1.0.0]: https://github.com/vaquarkhan/CogniMesh/releases/tag/v1.0.0

## [0.2.0] - 2026-06-16

### Added

- Platform operations (Tier 1–4): live dashboard, versioning, deploy approval, health/cost/audit, federated mesh, column lineage, self-heal, multi-cloud, plugins, copilot, DQ rules, SLA, open spec
- DynamoDB platform store (`PLATFORM_STORE=dynamodb`) with file fallback for versions, approvals, plugins, billing
- Terraform `platform-ops` module: DynamoDB state table, Athena workgroup, Bedrock/RDS Data API IAM
- Playwright portal E2E (`npm run test:portal-e2e`) for Operations panel and steward approvals
- LLM copilot (Bedrock), live Athena/S3/JDBC preview, AWS SFN/Glue import, agent deploy to Bedrock

### Changed

- API gateway bootstraps platform stores before listen (DynamoDB or local JSON)

[0.2.0]: https://github.com/vaquarkhan/CogniMesh/releases/tag/v0.2.0

## [0.1.0] - 2026-06-15

### Added

- Zero-code portal (React Flow): drag Source → Transform → Sink, deploy, marketplace
- `cognimesh.io/v1` DataContract schema, graph compiler, integrity gate
- Vaquar PVDM runtime: IceGuard, VRP, durable Step Functions, contract → mesh bridge
- API gateway with Cognito JWT auth (admin-only, no self-registration)
- Spring Boot catalog service (in-memory + DynamoDB)
- Embedded catalog fallback for local dev without Java
- Cognitive runtime (Go): epoch, frontier, compensation
- Bedrock Agent MCP service
- Production Terraform: VPC, S3 medallion, Cognito, Lambda, EKS, CloudFront
- Docker Compose full-stack local development
- Documentation: README, [Vaquar Pattern](docs/vaquar-pattern.md), architecture, local dev guide
- Integration tests: e2e pipeline, Vaquar bridge, PVDM runtime, API E2E (graceful catalog SKIP)

### Security

- JWT validation on pipeline routes; `AUTH_DISABLED` for local dev only
- Integrity gate design-time rules (`rules/default-policies.yaml`)
- PII governance fields on DataContract

[0.1.0]: https://github.com/vaquarkhan/CogniMesh/releases/tag/v0.1.0
