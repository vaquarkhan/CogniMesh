# Changelog

All notable changes to CogniMesh are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
