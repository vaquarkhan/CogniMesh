#!/usr/bin/env bash
# Register CogniMesh in the AWS Well-Architected Tool (one-time per account/region).
# Requires: AWS CLI v2, credentials with wellarchitected:CreateWorkload
#
# Usage:
#   REVIEW_OWNER=platform-lead@company.com ./scripts/register-well-architected-workload.sh
#   AWS_REGION=us-east-1 WORKLOAD_NAME=cognimesh-prod ./scripts/register-well-architected-workload.sh

set -euo pipefail

REVIEW_OWNER="${REVIEW_OWNER:?Set REVIEW_OWNER email}"
AWS_REGION="${AWS_REGION:-us-east-1}"
WORKLOAD_NAME="${WORKLOAD_NAME:-cognimesh-prod}"
ENVIRONMENT="${ENVIRONMENT:-PRODUCTION}"

DESIGN="CogniMesh: portal (CloudFront/S3) + API (ECS Fargate) + Cognito; Step Functions/Lambda integrity-gate-first pipelines; S3 medallion + KMS proof buckets; Lake Formation governance."

WORKLOAD_ID=$(aws wellarchitected create-workload \
  --region "$AWS_REGION" \
  --workload-name "$WORKLOAD_NAME" \
  --description "CogniMesh data mesh and governance platform" \
  --review-owner "$REVIEW_OWNER" \
  --environment "$ENVIRONMENT" \
  --architectural-design "$DESIGN" \
  --aws-regions "$AWS_REGION" \
  --lenses wellarchitected \
  --query WorkloadId --output text)

echo "WorkloadId: $WORKLOAD_ID"
echo "Console: https://${AWS_REGION}.console.aws.amazon.com/wellarchitected/home?region=${AWS_REGION}#/workload/${WORKLOAD_ID}/overview"
