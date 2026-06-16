"use strict";

let cachedAccountId = null;

/**
 * Resolve AWS account ID from env or STS (cached per process).
 * Returns null when credentials are unavailable (local dev).
 */
async function getAwsAccountId() {
  if (process.env.AWS_ACCOUNT_ID) return process.env.AWS_ACCOUNT_ID;
  if (cachedAccountId) return cachedAccountId;
  try {
    const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
    const client = new STSClient({ region: process.env.AWS_REGION || "us-east-1" });
    const out = await client.send(new GetCallerIdentityCommand({}));
    if (out.Account) cachedAccountId = out.Account;
    return out.Account || null;
  } catch {
    return null;
  }
}

function placeholderAccountId() {
  return process.env.AWS_ACCOUNT_ID || "ACCOUNT";
}

module.exports = { getAwsAccountId, placeholderAccountId };
