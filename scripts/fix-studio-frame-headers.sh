#!/bin/bash
# Fix AgentCore Studio CloudFront frame headers to allow embedding in CogniMesh portal.
# Run after deploying the studio CDK stack in any region.
#
# Usage: ./fix-studio-frame-headers.sh <studio-distribution-id> <portal-origin>
# Example: ./fix-studio-frame-headers.sh E18A8ML6T96319 https://d23xbo3h1l9hqg.cloudfront.net

set -e

DIST_ID="${1:?Usage: $0 <studio-distribution-id> <portal-origin>}"
PORTAL_ORIGIN="${2:?Usage: $0 <studio-distribution-id> <portal-origin>}"

echo "Fixing frame headers for studio distribution: $DIST_ID"
echo "Allowing embedding from: $PORTAL_ORIGIN"

# Get the distribution config to find the response headers policy
POLICY_ID=$(aws cloudfront get-distribution-config --id "$DIST_ID" \
  --query "DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId" --output text)

if [ "$POLICY_ID" = "None" ] || [ -z "$POLICY_ID" ]; then
  echo "No response headers policy found on distribution $DIST_ID"
  exit 1
fi

echo "Response headers policy: $POLICY_ID"

# Get the current policy config
ETAG=$(aws cloudfront get-response-headers-policy --id "$POLICY_ID" \
  --query "ETag" --output text)
aws cloudfront get-response-headers-policy-config --id "$POLICY_ID" \
  --query "ResponseHeadersPolicyConfig" > /tmp/rhp-config.json

# Modify: remove FrameOptions, update CSP frame-ancestors
# This uses node for JSON manipulation (simpler than jq for nested structures)
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('/tmp/rhp-config.json', 'utf8'));

// Remove X-Frame-Options (can't allow cross-origin framing with XFO)
if (config.SecurityHeadersConfig) {
  delete config.SecurityHeadersConfig.FrameOptions;
}

// Update CSP frame-ancestors to allow portal origin
if (config.SecurityHeadersConfig?.ContentSecurityPolicy) {
  let csp = config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy || '';
  csp = csp.replace(/frame-ancestors[^;]*/,
    \"frame-ancestors 'self' ${PORTAL_ORIGIN}\");
  config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy = csp;
}

fs.writeFileSync('/tmp/rhp-config-updated.json', JSON.stringify(config, null, 2));
console.log('Updated policy config written to /tmp/rhp-config-updated.json');
"

# Apply the update
aws cloudfront update-response-headers-policy \
  --id "$POLICY_ID" \
  --if-match "$ETAG" \
  --response-headers-policy-config file:///tmp/rhp-config-updated.json

echo ""
echo "Done. Studio distribution $DIST_ID now allows framing from $PORTAL_ORIGIN."
echo "Changes propagate in ~30-60 seconds."
