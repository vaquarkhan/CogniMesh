# AWS Well-Architected Framework (CogniMesh)

This document maps CogniMesh production controls to the [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) six pillars and explains how to run a formal review in the **AWS Well-Architected Tool**.

## Register a workload in AWS Well-Architected Tool

The AWS provider in this repo does not yet include `aws_wellarchitected_workload`. Register via CLI after prod apply:

```bash
REVIEW_OWNER=platform-lead@yourcompany.com \
  WORKLOAD_NAME=cognimesh-prod \
  AWS_REGION=us-east-1 \
  ./scripts/register-well-architected-workload.sh
```

The script prints a console URL to start a lens review (Well-Architected Framework). Terraform registers infrastructure; humans complete the review in the AWS console.

## Pillar mapping (current main)

### Operational Excellence

| Control | CogniMesh implementation |
|---------|-------------------------|
| Runbooks / ops visibility | Portal **Operations** panel, `/api/v1/platform/*`, pipeline observability API |
| IaC | Terraform modules under `infra/terraform/` |
| CI/CD | GitHub Actions: lint, unit/integration tests, `terraform validate`, npm audit |
| Logging | Structured JSON API logs → CloudWatch Logs (ECS); CloudTrail account trail |
| Metrics & alarms | EMF custom metrics (`CogniMesh` namespace), CloudWatch dashboard + SNS alarms (`modules/observability`) |
| Execution history | Persisted via platform store (DynamoDB in prod) |

**Gaps to discuss in review:** distributed tracing (OTel opt-in, not default-exported to X-Ray); Step Functions execution dashboards not in IaC.

### Security

| Control | Implementation |
|---------|----------------|
| Identity | Cognito admin-only users, MFA ON (prod), JWT validation on every API route |
| Edge | WAFv2 (OWASP + rate limit), CloudFront OAC, security response headers |
| Data at rest | S3 SSE-KMS (checkpoint/proof/gold), DynamoDB encryption, remote state KMS |
| Auth bypass guard | `AUTH_DISABLED` hard-fail in production |
| Detective | CloudTrail, GuardDuty, AWS Config recorder |
| Least privilege | IAM scoped SFN/Lambda/Glue ARNs; LF-aware domain writer |

**Gaps:** scope remaining `Resource = "*"` on Bedrock/RDS preview roles; Secrets Manager for runtime secrets.

### Reliability

| Control | Implementation |
|---------|----------------|
| Multi-AZ | VPC across 2 AZs; ECS `desired_count >= 2` |
| Health checks | ALB `/health`, ECS task health check |
| Pipeline integrity | Integrity-gate-first Step Functions; VRP fail-closed |
| State durability | S3 versioning, DynamoDB PITR (platform state), checkpoint/proof retention |
| DLQ | SQS dead-letter for pipeline failures |

**Gaps:** no cross-region DR; execution history capped at 200 runs per store key.

### Performance Efficiency

| Control | Implementation |
|---------|----------------|
| Static portal | CloudFront + S3 (no compute for UI) |
| API scaling | ECS Fargate horizontal scale via `desired_count` |
| Athena | Dedicated workgroup with CloudWatch metrics enabled |
| Right-sizing EKS | `enable_eks = false` by default |

### Cost Optimization

| Control | Implementation |
|---------|----------------|
| Optional expensive services | `enable_waf`, `enable_eks` flags |
| Lifecycle | S3 lifecycle on checkpoints (30d) and proofs (90d) |
| Serverless path | Lambda + Step Functions for pipelines vs always-on EKS |

### Sustainability

| Control | Implementation |
|---------|----------------|
| Minimize idle compute | EKS off by default; Fargate scales to `desired_count` |
| Efficient storage tiers | Medallion buckets with lifecycle policies |

## Running a review (console workflow)

1. Apply prod with `enable_well_architected_workload = true` **or** create a workload manually in [Well-Architected Tool](https://console.aws.amazon.com/wellarchitected/).
2. Choose lens: **AWS Well-Architected Framework** (add **Serverless** if SFN/Lambda-heavy).
3. For each pillar, use this doc and `infra/terraform/README.md` as evidence.
4. Record **high-risk issues (HRIs)** and link to GitHub issues or roadmap (`docs/POSITIONING.md`).
5. Export PDF report after milestone for auditors.

## Related

- [Terraform README](../infra/terraform/README.md) — deploy order, feature flags
- [Platform Operations API](PLATFORM_OPS.md) — product observability APIs
- Security hardening commit: remote state, API tier, WAF, KMS, detective controls
