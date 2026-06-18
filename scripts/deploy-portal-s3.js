#!/usr/bin/env node
/**
 * Build portal and sync dist/ to S3 (+ optional CloudFront invalidation).
 *
 * Usage:
 *   PORTAL_S3_BUCKET=my-portal-bucket node scripts/deploy-portal-s3.js
 *   CLOUDFRONT_DISTRIBUTION_ID=E123ABC node scripts/deploy-portal-s3.js
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const bucket = process.env.PORTAL_S3_BUCKET;
const distId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const region = process.env.AWS_REGION || "us-east-1";

if (!bucket) {
  console.error("Set PORTAL_S3_BUCKET (e.g. from terraform output portal_bucket)");
  process.exit(1);
}

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

run("npm ci", path.join(root, "portal"));
run("npm run build", path.join(root, "portal"));
run(`aws s3 sync portal/dist/ s3://${bucket}/ --delete --region ${region}`);

if (distId) {
  run(
    `aws cloudfront create-invalidation --distribution-id ${distId} --paths "/*" --region ${region}`
  );
  console.log(`CloudFront invalidation started for ${distId}`);
}

console.log(`\nPortal deployed to s3://${bucket}/`);
