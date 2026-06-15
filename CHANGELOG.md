# Changelog

All notable changes to CogniMesh are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Docker Compose, embedded catalog fallback, portal postinstall, E2E graceful SKIP
- LICENSE, CHANGELOG, SECURITY.md, PLATFORM_CHECKLIST.md
- Unit tests (`npm run test:unit`), full CI workflow (`ci.yml`)
- ESLint + Prettier, safe YAML parsing, CSRF + rate limiting
- Structured JSON logs, deep `/health`, audit log (`/api/v1/audit`)
- Portal: toasts, loading overlay, undo/redo, mobile warning, freshness badges

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
