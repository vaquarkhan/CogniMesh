#!/bin/bash
set -e

# Deploy AgentCore Studio (AWS sample) and wire it to CogniMesh.
# This clones the AWS sample repo, deploys the CDK stack, builds the frontend,
# fixes the frame headers, and outputs the studio URL.
#
# Usage: ./scripts/deploy-studio.sh --region us-east-1 --portal-origin https://your-portal.cloudfront.net
#
# Prerequisites:
#   - AWS CLI, CDK (npx aws-cdk), Python 3.12+, pip, Docker
#   - The CogniMesh portal must already be deployed (need its CloudFront URL for frame-ancestors)

REGION="${REGION:-us-east-1}"
ENV_NAME="${ENV_NAME:-demo}"
PROJECT_NAME="${PROJECT_NAME:-agentcore-workflow}"
PORTAL_ORIGIN=""
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
WORK_DIR="/tmp/agentcore-studio-deploy"

while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2;;
    --env-name) ENV_NAME="$2"; shift 2;;
    --portal-origin) PORTAL_ORIGIN="$2"; shift 2;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2;;
    --work-dir) WORK_DIR="$2"; shift 2;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

if [ -z "$PORTAL_ORIGIN" ]; then
  echo "ERROR: --portal-origin is required (your CogniMesh portal CloudFront URL)"
  echo "Usage: $0 --region us-east-1 --portal-origin https://dXXXXXX.cloudfront.net"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  AgentCore Studio Deploy                                 "
echo "║  Region: $REGION                                         "
echo "║  Portal: $PORTAL_ORIGIN                                  "
echo "╚══════════════════════════════════════════════════════════╝"

# Clone
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
git clone --depth 1 https://github.com/aws-samples/sample-ai-agent-factory.git "$WORK_DIR/repo"
cd "$WORK_DIR/repo/Agentic-ai-self-service"

# Fix cdk.json for Windows/cross-platform (python3 -> python)
sed -i.bak 's/python3 app.py/python app.py/' infra/cdk.json 2>/dev/null || true

# Patch the CDK stack for region-portability:
# 1. Make CLOUDFRONT-scoped WAF conditional on us-east-1 (it fails in other regions)
# 2. Add portal_origin context support for CSP frame-ancestors
echo "Patching CDK for region portability..."
if grep -q "WebACL" infra/stacks/platform_stack.py 2>/dev/null; then
  # Add region check around WAF creation
  sed -i.bak 's/web_acl = wafv2.CfnWebACL/if self.region == "us-east-1":\n            web_acl = wafv2.CfnWebACL/' \
    infra/stacks/platform_stack.py 2>/dev/null || true
fi

# Patch ResponseHeadersPolicy to support portal_origin for frame-ancestors
if grep -q "frame-ancestors" infra/stacks/platform_stack.py 2>/dev/null; then
  sed -i.bak "s/frame-ancestors 'none'/frame-ancestors 'self' ${PORTAL_ORIGIN//\//\\/}/" \
    infra/stacks/platform_stack.py 2>/dev/null || true
  # Remove X-Frame-Options (can't allow cross-origin framing with XFO)
  sed -i.bak '/frame_options/d' infra/stacks/platform_stack.py 2>/dev/null || true
fi

# Install infra deps
pip install -r infra/requirements.txt
pip install "cdk-nag>=2.28.0,<3"

# Install Lambda deps
pip install --platform manylinux2014_x86_64 --implementation cp \
  --python-version 3.12 --only-binary=:all: \
  -r backend/requirements-lambda.txt -t backend/lib 2>/dev/null || true

# Deploy CDK
cd infra
npx --yes aws-cdk@latest deploy "${PROJECT_NAME}-${ENV_NAME}" \
  --require-approval never \
  -c environment_name="$ENV_NAME" \
  -c aws_region="$REGION" \
  -c project_name="$PROJECT_NAME" \
  -c cognito_users="$ADMIN_EMAIL" \
  -c portal_origin="$PORTAL_ORIGIN"
cd ..

# Get outputs
STACK_NAME="${PROJECT_NAME}-${ENV_NAME}"
CF_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue | [0]" --output text)
BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?contains(OutputKey,'S3Bucket')].OutputValue | [0]" --output text)
POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?contains(OutputKey,'UserPool')].OutputValue | [0]" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?contains(OutputKey,'Client')].OutputValue | [0]" --output text)

echo ""
echo "Stack outputs:"
echo "  CloudFront: $CF_URL"
echo "  S3 Bucket:  $BUCKET"
echo "  Cognito:    $POOL_ID / $CLIENT_ID"

# Build + upload studio frontend
cd "$WORK_DIR/repo/Agentic-ai-self-service/frontend"
npm install
VITE_API_BASE_URL="$CF_URL" \
VITE_AWS_REGION="$REGION" \
VITE_COGNITO_USER_POOL_ID="$POOL_ID" \
VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
npm run build

aws s3 sync dist/ "s3://$BUCKET/" --delete --region "$REGION"

# Set admin password
echo ""
echo "Setting Cognito password for $ADMIN_EMAIL..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --password "CogniMesh2026!" \
  --permanent \
  --region "$REGION" 2>/dev/null || echo "(password already set or user doesn't exist)"

# Fix frame headers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/fix-studio-frame-headers.sh" ]; then
  DIST_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Origins.Items[].DomainName, '$BUCKET')].Id | [0]" \
    --output text)
  if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
    bash "$SCRIPT_DIR/fix-studio-frame-headers.sh" "$DIST_ID" "$PORTAL_ORIGIN"
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Studio deployed!                                        "
echo "║  URL: $CF_URL                                            "
echo "║                                                          "
echo "║  Now rebuild CogniMesh portal with:                      "
echo "║    VITE_AGENTCORE_STUDIO_URL=$CF_URL npm run build       "
echo "╚══════════════════════════════════════════════════════════╝"
