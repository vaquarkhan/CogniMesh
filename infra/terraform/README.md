# CogniMesh Terraform: Production Infrastructure

Vaquar Pattern-aligned IaC for CogniMesh. Module layout mirrors [aws-serverless-datamesh-framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework) conventions.

**Pattern spec:** [docs/vaquar-pattern.md](../../docs/vaquar-pattern.md) (The Vaquar Pattern by Vaquarkhan)

## Module map

| Module | Responsibility |
|--------|----------------|
| `networking` | VPC, public/private subnets, IGW, NAT |
| `storage` | Checkpoint/proof/lakehouse/medallion S3; optional KMS CMK for proofs |
| `iam` | Pipeline orchestrator + domain writer roles (LF + KMS aware) |
| `glue` | Glue Data Catalog database |
| `dynamodb` | Marketplace product registry |
| `orchestration` | Step Functions with integrity-gate-first ASL |
| `governance` | Lake Formation consumer SELECT + steward grant policy |
| `messaging` | SQS DLQ for pipeline failures |
| `cognito` | Admin-only users (no self-registration), MFA configurable |
| `lambda` | Integrity gate + domain writer Lambda functions |
| `eks` | EKS cluster for cognitive runtime (opt-in) |
| `portal-cdn` | S3 + CloudFront OAC, security headers, optional WAF, `/api/*` proxy |
| `api-service` | ECS Fargate + public ALB for `cognimesh-api` (private tasks) |
| `security-logging` | CloudTrail + GuardDuty + Config (optional) |
| `observability` | CloudWatch dashboard + alarms (ALB, ECS, EMF, WAF) |
| `bootstrap/remote-state` | One-time S3 + DynamoDB + KMS for Terraform state |

## Environments

```
environments/
  dev/    # Auto-named S3 buckets, networking, glue, dynamodb
  prod/   # Full stack with security feature flags
```

## Production deploy sequence

**Do not apply prod without remote state and the API tier** unless you are only experimenting in a sandbox account.

### 1. Bootstrap remote state (once per account/region)

```bash
cd infra/terraform/bootstrap/remote-state
terraform init && terraform apply
terraform output backend_hcl   # paste into environments/prod/backend.hcl
```

### 2. Configure prod

```bash
cd environments/prod
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl   # fill from bootstrap output
# Edit bucket names (globally unique) and default_admin_email
```

### 3. Init, plan, apply

```bash
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Lambda zips are built automatically during plan/apply (external data source). To build locally:

```bash
npm run package:lambda
npm run test:lambda-zips
```

### 4. Post-apply: Cognito callback, API CORS, portal upload

```bash
terraform output portal_cloudfront_url
# Add to terraform.tfvars:
# portal_cloudfront_callback_url = "https://YOUR_DIST.cloudfront.net/"
# portal_cloudfront_logout_url   = "https://YOUR_DIST.cloudfront.net/"
terraform apply
```

This updates Cognito callback/logout URLs **and** `CORS_ORIGINS` on the API task (exact CloudFront origin, trailing slash stripped).

CloudFront routes `/api/*`, `/health`, `/metrics`, and `/api/health` to the API ALB. SPA fallback is **404 only** (not 403), so API errors return JSON.

### 5. API container image vs Terraform env

Terraform can set `CORS_ORIGIN_SUFFIXES=.cloudfront.net`, but **the running image must contain the code that reads it** (`services/api-gateway/lib/cors-origins.js`, shipped in `84cbf15`).

| API image | CloudFront POST/CSRF unblock |
|-----------|------------------------------|
| `cognimesh-api:1.0.0` (pre-fix) | Set `portal_cloudfront_callback_url` and re-apply (feeds exact origin into `CORS_ORIGINS`). |
| `cognimesh-api:1.0.1+` | Publish image from current `main`, set `api_container_image`, apply (uses `CORS_ORIGIN_SUFFIXES`). |

**Fastest unblock on 1.0.0** (no image rebuild): set `portal_cloudfront_callback_url` / `portal_logout_urls` as above and `terraform apply` (ECS picks up new `CORS_ORIGINS`).

**Permanent fix** — use the CI-built image (pushed on every merge to `main`):

```bash
# GitHub Actions → Docker API (main) publishes:
#   ghcr.io/vaquarkhan/cognimesh-api:main
#   ghcr.io/vaquarkhan/cognimesh-api:sha-<commit>
```

```hcl
# terraform.tfvars — pin a sha for immutable prod
api_container_image = "ghcr.io/vaquarkhan/cognimesh-api:sha-COMMIT_SHA"
```

Or publish a semver release via **Actions → Publish** (`1.0.1`, etc.).

```bash
terraform apply
# Or, if only the image tag changed: aws ecs update-service --cluster ... --service ... --force-new-deployment
```

Verify: `POST https://YOUR_DIST.cloudfront.net/api/v1/pipelines/preview` returns JSON (not 403 CSRF, not HTML).

Build and sync the portal (no `VITE_API_URL` needed when `enable_api_service` proxies `/api/*` via CloudFront):

```bash
cd portal && npm ci && npm run build
aws s3 sync dist/ s3://$(cd ../infra/terraform/environments/prod && terraform output -raw portal_bucket) --delete
```

## Feature flags (prod defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `enable_cognito` | `true` | Cognito user pool + SPA client |
| `cognito_mfa_configuration` | `ON` | Enforce MFA for admin portal users |
| `enable_step_functions` | `true` | Pipeline orchestrator SFN |
| `enable_lake_formation_governance` | `true` | LF consumer permissions |
| `enable_integrity_gate_lambda` | `true` | Integrity gate + domain writer Lambdas |
| `enable_eks` | `false` | EKS for cognitive pipelines only |
| `enable_portal_cdn` | `true` | CloudFront + S3 portal hosting |
| `enable_waf` | `true` | WAFv2 on CloudFront (OWASP + rate limit; adds cost) |
| `enable_api_service` | `true` | ECS Fargate API (requires `enable_platform_ops`) |
| `enable_platform_ops` | `true` | Athena workgroup, platform DynamoDB, API IAM role |
| `enable_kms_for_sensitive_buckets` | `true` | CMK for checkpoint + proof buckets |
| `enable_security_logging` | `true` | CloudTrail + GuardDuty + Config modules |
| `enable_observability` | `true` | CloudWatch dashboard + alarms |

Set `enable_waf = false` to reduce monthly cost if you accept L7 exposure on the portal.

AWS Well-Architected reviews: see [docs/WELL_ARCHITECTED.md](../../docs/WELL_ARCHITECTED.md) and `scripts/register-well-architected-workload.sh`.

## Observability (prod)

| Layer | What you get |
|-------|----------------|
| **Logs** | ECS API to CloudWatch Logs `/ecs/{prefix}-api` (30d) |
| **Metrics** | EMF from API (`CogniMesh` namespace): deploy, preview, http_5xx |
| **Dashboard** | `terraform output ops_dashboard_name` |
| **Alarms** | ALB 5xx, ECS tasks, deploy_failed, WAF blocks; optional SNS (`ops_alert_email`) |
| **Product** | Run history persisted in DynamoDB; `/api/v1/pipelines/:name/observability` |
| **Traces** | OpenTelemetry opt-in via `OTEL_SDK_ENABLED` + OTLP endpoint |

See [docs/WELL_ARCHITECTED.md](../../docs/WELL_ARCHITECTED.md) for pillar mapping and formal WAFR workflow.

## Cognito default user

- `allow_admin_create_user_only = true`: no self-registration
- Terraform creates one admin user with a random initial password

```bash
terraform output -raw cognito_default_admin_initial_password
terraform output cognito_default_admin_username
```

## Security defaults

- **State:** S3 backend with versioning, SSE-KMS, DynamoDB locking (after bootstrap)
- **Portal:** OAC (SigV4), HTTPS redirect, response headers (HSTS, X-Frame-Options, etc.), optional WAF
- **API:** ECS tasks in private subnets; ALB in public subnets; `AUTH_DISABLED=false` in container env
- **S3:** versioning, public access blocked; checkpoint/proof use customer-managed KMS when enabled
- **Cognito:** 12+ char password policy, MFA on by default in prod, no public sign-up
- **Detective:** CloudTrail (multi-region, log validation) + GuardDuty when `enable_security_logging`

## Vaquar Pattern alignment

```
Rules (integrity-gate) → Physical (Glue/Lambda) → Verify (VRP) → Metadata (Iceberg/LF)
```

CogniMesh Step Functions template starts with `IntegrityGate` state before extract/transform/load.
