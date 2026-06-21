#!/bin/bash
set -e

# CogniMesh One-Click Environment Deploy
# Usage: ./scripts/deploy-environment.sh [OPTIONS]
#
# Deploys the full CogniMesh stack from git in a single region:
#   1. Terraform (VPC, ECS, Lambda, S3, Cognito, CloudFront, etc.)
#   2. ECR repo + API Docker image build + push
#   3. ECS service update (deploys the API)
#   4. Portal build + S3 sync + CloudFront invalidation
#
# Prerequisites:
#   - AWS CLI configured (aws sts get-caller-identity works)
#   - Terraform >= 1.9.0
#   - Docker (for API image build)
#   - Node.js >= 20 + npm
#
# Options:
#   --region REGION          AWS region (default: us-west-2)
#   --env-dir DIR            Terraform env directory name under infra/terraform/environments/ (default: usw2)
#   --prefix PREFIX          Resource name prefix (default: cognimesh-usw2)
#   --skip-terraform         Skip terraform apply (assume already applied)
#   --skip-api               Skip API image build+push+deploy
#   --skip-portal            Skip portal build+deploy
#   --studio-url URL         AgentCore Studio URL for embedding (optional)

REGION="${REGION:-us-west-2}"
ENV_DIR="${ENV_DIR:-prod}"
PREFIX="${PREFIX:-cognimesh}"
SKIP_TF=false
SKIP_API=false
SKIP_PORTAL=false
STUDIO_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2;;
    --env-dir) ENV_DIR="$2"; shift 2;;
    --prefix) PREFIX="$2"; shift 2;;
    --skip-terraform) SKIP_TF=true; shift;;
    --skip-api) SKIP_API=true; shift;;
    --skip-portal) SKIP_PORTAL=true; shift;;
    --studio-url) STUDIO_URL="$2"; shift 2;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
TF_DIR="$REPO_ROOT/infra/terraform/environments/$ENV_DIR"
ECR_REPO="${PREFIX}-api"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  CogniMesh Deploy: $PREFIX @ $REGION                    "
echo "║  Account: $ACCOUNT_ID                                   "
echo "║  TF dir:  $TF_DIR                                       "
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── STEP 1: Terraform ───
if [ "$SKIP_TF" = false ]; then
  echo "▶ Step 1: Terraform apply..."
  cd "$TF_DIR"
  terraform init -input=false
  terraform apply -auto-approve -input=false
  cd "$REPO_ROOT"
  echo "✓ Terraform complete"
else
  echo "⊘ Skipping Terraform (--skip-terraform)"
fi

# ─── STEP 2: API Docker Image ───
if [ "$SKIP_API" = false ]; then
  echo ""
  echo "▶ Step 2: Build + push API image..."

  # Create ECR repo if not exists
  aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$REGION" 2>/dev/null || \
    aws ecr create-repository --repository-name "$ECR_REPO" --region "$REGION"

  # Login to ECR
  aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "$ECR_URI"

  # Build and push
  docker build -f docker/api.Dockerfile -t "${ECR_REPO}:latest" .
  docker tag "${ECR_REPO}:latest" "${ECR_URI}:latest"
  docker push "${ECR_URI}:latest"
  echo "✓ API image pushed: ${ECR_URI}:latest"

  # Update ECS service
  echo "  Updating ECS service..."
  aws ecs update-service \
    --cluster "${PREFIX}-api" \
    --service "${PREFIX}-api" \
    --force-new-deployment \
    --region "$REGION" > /dev/null
  echo "✓ ECS service updated (rolling deploy in progress)"
else
  echo "⊘ Skipping API build (--skip-api)"
fi

# ─── STEP 3: Portal ───
if [ "$SKIP_PORTAL" = false ]; then
  echo ""
  echo "▶ Step 3: Build + deploy portal..."
  cd "$REPO_ROOT/portal"
  npm install --prefer-offline

  # Set env vars for the build
  export VITE_AGENTCORE_STUDIO_URL="${STUDIO_URL}"

  npm run build
  cd "$REPO_ROOT"

  # Get portal bucket from terraform output (or use convention)
  PORTAL_BUCKET="${PREFIX}-portal-${ACCOUNT_ID}"
  aws s3 sync portal/dist/ "s3://${PORTAL_BUCKET}/" --delete --region "$REGION"

  # Invalidate CloudFront (find the distribution)
  DIST_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[?Id=='${PREFIX}-portal']].Id | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" > /dev/null
    echo "✓ Portal deployed + CloudFront invalidated (dist: $DIST_ID)"
  else
    echo "✓ Portal deployed to S3 (no CloudFront distribution found for invalidation)"
  fi
else
  echo "⊘ Skipping portal (--skip-portal)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Deploy complete!                                        "
echo "║  Region: $REGION                                         "
echo "║  API:    ECS ${PREFIX}-api (rolling deploy)              "
echo "║  Portal: s3://${PREFIX}-portal-${ACCOUNT_ID}             "
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  - Wait ~2min for ECS to stabilize (aws ecs describe-services --cluster ${PREFIX}-api --services ${PREFIX}-api --query 'services[0].deployments')"
echo "  - Open the portal CloudFront URL"
echo "  - (Optional) Deploy AgentCore Studio separately and set VITE_AGENTCORE_STUDIO_URL"
