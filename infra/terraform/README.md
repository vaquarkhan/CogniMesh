# CogniMesh Terraform: Production Infrastructure

Vaquar Pattern–aligned IaC for CogniMesh. Module layout mirrors [aws-serverless-datamesh-framework](https://github.com/vaquarkhan/aws-serverless-datamesh-framework) conventions.

## Module map

| Module | Responsibility |
|--------|----------------|
| `networking` | VPC, private/public subnets |
| `storage` | Checkpoint, proof, lakehouse, bronze/silver/gold S3 (encrypted, no public access) |
| `iam` | Pipeline orchestrator + domain writer roles (LF-aware) |
| `glue` | Glue Data Catalog database |
| `dynamodb` | Marketplace product registry |
| `orchestration` | Step Functions with integrity-gate-first ASL |
| `governance` | Lake Formation consumer SELECT + steward grant policy |
| `messaging` | SQS DLQ for pipeline failures |
| `cognito` | **Admin-only users**: self-registration disabled |
| `lambda` | Integrity gate + domain writer Lambda functions |
| `eks` | EKS cluster for cognitive runtime workloads |
| `portal-cdn` | S3 origin + CloudFront distribution for portal static assets |

## Environments

```
environments/
  dev/    # Auto-named S3 buckets, networking, glue, dynamodb
  prod/   # Full stack with feature flags
```

## Production deploy

```bash
cd environments/prod
cp terraform.tfvars.example terraform.tfvars
# Edit bucket names (globally unique) and default_admin_email

terraform init
terraform plan
terraform apply
```

### Cognito default user

- `allow_admin_create_user_only = true`: **no self-registration**
- Terraform creates one admin user with a random initial password
- Retrieve credentials:

```bash
terraform output -raw cognito_default_admin_initial_password
terraform output cognito_default_admin_username
```

Wire portal/API:

```bash
export COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
export COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
export AUTH_DISABLED=false
```

## Feature flags (prod)

| Variable | Default | Purpose |
|----------|---------|---------|
| `enable_cognito` | `true` | Cognito user pool + SPA client |
| `enable_step_functions` | `true` | Pipeline orchestrator SFN |
| `enable_lake_formation_governance` | `true` | LF consumer permissions |
| `enable_integrity_gate_lambda` | `true` | Integrity gate + domain writer Lambdas |
| `enable_eks` | `true` | EKS cluster for cognitive pipelines |
| `enable_portal_cdn` | `true` | CloudFront + S3 portal hosting |

## Vaquar Pattern alignment

```
Rules (integrity-gate) → Physical (Glue/Lambda) → Verify (VRP) → Metadata (Iceberg/LF)
```

CogniMesh Step Functions template starts with `IntegrityGate` state before extract/transform/load.

## Security defaults

- S3: versioning, AES256 encryption, public access blocked
- Cognito: 12+ char password policy, optional MFA, no public sign-up
- DynamoDB: PITR + server-side encryption
- SQS DLQ: KMS alias
