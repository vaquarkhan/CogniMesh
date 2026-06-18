# Security Policy

CogniMesh handles data pipeline definitions, authentication tokens, and metadata that may
describe PII-bearing datasets. We take security reports seriously.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

1. Open a **private** [GitHub Security Advisory](https://github.com/vaquarkhan/CogniMesh/security/advisories/new) on this repository.
2. Include:
   - Description of the issue and impact
   - Steps to reproduce
   - Affected component (portal, API, catalog, Terraform, etc.)
   - CogniMesh version or commit SHA
3. We aim to acknowledge advisory reports within **3 business days** and provide a remediation timeline within **14 days** for confirmed issues.

For **non-security** bugs and feature requests, use [GitHub Issues](https://github.com/vaquarkhan/CogniMesh/issues).

## Security controls in CogniMesh

| Area | Control |
|------|---------|
| Authentication | Amazon Cognito JWT; self-registration disabled in production |
| API | Rate limiting, CSRF origin checks, request size limits |
| Contracts | Safe YAML parsing (alias limits, size caps) |
| Governance | Integrity gate before deploy and catalog registration |
| Infrastructure | S3 encryption, no public buckets, Lake Formation integration |
| Secrets | `.env` gitignored; use AWS Secrets Manager for RDS in production |

## Secure development

- Run `npm audit` and address critical findings before release
- Never commit `.env`, credentials, or Terraform state files
- Use `AUTH_DISABLED=true` only on localhost
- Enable `AWS_DEPLOY_ENABLED` only after integrity gate PASS in CI

## Audit and compliance

Production deployments should enable:

- CloudTrail for AWS API calls
- CogniMesh audit log (`AUDIT_LOG_ENABLED=true`) for deploy actions
- Lake Formation audit for consumer data access
