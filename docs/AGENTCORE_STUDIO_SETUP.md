# AgentCore Studio Setup

The **AgentCore Studio** tab in CogniMesh embeds the AWS-sample AgentCore self-service
platform via an iframe. This is a **separate deployment** — by design, it is NOT vendored
into CogniMesh because:

1. It's a distinct Apache-2.0/MIT-0 project (`aws-samples/sample-ai-agent-factory`)
2. It has its own CDK stack, Cognito pool, API Gateway, and DynamoDB tables
3. Embedding by URL keeps CogniMesh's build independent of the studio's Python/CDK toolchain

## Deploying the Studio

### Prerequisites
- Python 3.12+, AWS CDK (`npm install -g aws-cdk`)
- AWS CLI configured for the target region

### Steps

```bash
# 1. Clone the sample repo
git clone https://github.com/aws-samples/sample-ai-agent-factory.git
cd sample-ai-agent-factory/Agentic-ai-self-service

# 2. Install deps
pip install -r infra/requirements.txt
pip install "cdk-nag>=2.28.0,<3"  # Pin to 2.x (3.x breaks NagSuppressions)
pip install --platform manylinux2014_x86_64 --implementation cp \
  --python-version 3.12 --only-binary=:all: \
  -r backend/requirements-lambda.txt -t backend/lib

# 3. Deploy the CDK stack
npx aws-cdk deploy agentcore-workflow-<env> \
  --require-approval never \
  -c environment_name=<env> \
  -c aws_region=<region> \
  -c project_name=agentcore-workflow \
  -c cognito_users=<admin-email> \
  -c portal_origin=<your-cognimesh-portal-url>

# 4. Build + upload the studio frontend
cd frontend && npm install
VITE_API_BASE_URL=<studio-cloudfront-url> npm run build
aws s3 sync dist/ s3://<studio-bucket> --delete

# 5. Set Cognito password
aws cognito-idp admin-set-user-password \
  --user-pool-id <pool-id> \
  --username <admin-email> \
  --password "<password>" --permanent

# 6. Fix frame headers (allow CogniMesh portal to embed)
./scripts/fix-studio-frame-headers.sh <studio-dist-id> <portal-origin>
```

### Wiring to CogniMesh

Set the studio URL when building the CogniMesh portal:

```bash
VITE_AGENTCORE_STUDIO_URL=https://<studio-cloudfront-url> npm run build
```

Or pass it to the deploy script:

```bash
./scripts/deploy-environment.sh --studio-url https://<studio-cloudfront-url>
```

### Without the Studio

If you don't deploy the studio, the AgentCore Studio tab shows:
- A "No studio URL configured" message
- An "Open in new tab" button (which goes nowhere if URL is empty)

The rest of CogniMesh (pipelines, agents, dashboard) works independently.

### Known Limitations

- Cross-origin iframe + Cognito auth may be storage-partitioned in some browsers
  (Firefox, Safari with strict tracking protection). The "Open in new tab" fallback works.
- The studio's CloudFront WAF (CLOUDFRONT scope) can only be created in us-east-1.
  In other regions, deploy without WAF or use a regional WAF on the API Gateway.
- `cdk-nag` version 3.x breaks the stack — pin to `>=2.28.0,<3`.

### Teardown

```bash
cdk destroy agentcore-workflow-<env> \
  -c environment_name=<env> \
  -c aws_region=<region> \
  -c project_name=agentcore-workflow
```

Note: S3 buckets use RETAIN policy — empty them manually before destroy.
```
