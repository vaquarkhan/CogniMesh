"use strict";

const { placeholderAccountId } = require("./account-id");

function resolveRegion(region) {
  return region || process.env.AWS_REGION || "us-east-1";
}

function resolveNamePrefix(namePrefix, domain) {
  return namePrefix || process.env.AWS_NAME_PREFIX || (domain ? `cognimesh-${domain}` : "cognimesh");
}

function buildLambdaQualifiedArn({
  functionSuffix = "domain-writer",
  alias = "live",
  accountId,
  region,
  namePrefix,
  domain,
} = {}) {
  const envArn = process.env.VAQUAR_DOMAIN_WRITER_ARN;
  if (functionSuffix === "domain-writer" && envArn) return envArn;

  const reg = resolveRegion(region);
  const acct = accountId || process.env.AWS_ACCOUNT_ID || placeholderAccountId();
  const prefix = resolveNamePrefix(namePrefix, domain);
  return `arn:aws:lambda:${reg}:${acct}:function:${prefix}-${functionSuffix}:${alias}`;
}

function resolveIntegrityGateFunctionName({ namePrefix, domain } = {}) {
  return (
    process.env.INTEGRITY_GATE_FUNCTION ||
    `${resolveNamePrefix(namePrefix, domain)}-integrity-gate`
  );
}

function resolveBucketName(envKey, fallbackLiteral) {
  const v = process.env[envKey];
  if (v) return v.startsWith("s3://") ? v : `s3://${v}`;
  return fallbackLiteral;
}

module.exports = {
  buildLambdaQualifiedArn,
  resolveIntegrityGateFunctionName,
  resolveBucketName,
};
