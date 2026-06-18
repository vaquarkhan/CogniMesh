"use strict";

const crypto = require("crypto");

function tableUuid(catalog = {}) {
  const key = `${catalog.database || "default"}.${catalog.table || "output"}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

function resolveEnvironmentBinding(catalog = {}, options = {}) {
  return {
    aws_account_id: options.awsAccountId || process.env.AWS_ACCOUNT_ID || process.env.COGNIMESH_AWS_ACCOUNT_ID || "local",
    environment: options.environment || process.env.VRP_ENVIRONMENT || process.env.NODE_ENV || "dev",
    table_uuid: tableUuid(catalog),
    region: options.region || process.env.AWS_REGION || "us-east-1",
  };
}

function verifyEnvironmentBinding(proof, options = {}) {
  const bound = proof?.environment_binding;
  if (!bound) {
    return { valid: true, skipped: true, reason: "no environment_binding in proof" };
  }
  const expectedEnv = options.environment || process.env.VRP_ENVIRONMENT || process.env.NODE_ENV || "dev";
  const expectedAccount = options.awsAccountId || process.env.AWS_ACCOUNT_ID || process.env.COGNIMESH_AWS_ACCOUNT_ID || "local";

  if (options.requireEnvironmentMatch === false) {
    return { valid: true, skipped: true };
  }

  const reasons = [];
  if (bound.environment !== expectedEnv) {
    reasons.push(`environment mismatch (proof=${bound.environment}, expected=${expectedEnv})`);
  }
  if (options.awsAccountId && bound.aws_account_id !== expectedAccount) {
    reasons.push(`account mismatch (proof=${bound.aws_account_id}, expected=${expectedAccount})`);
  }
  if (options.tableUuid && bound.table_uuid !== options.tableUuid) {
    reasons.push("table_uuid mismatch");
  }

  return {
    valid: reasons.length === 0,
    reason: reasons.join("; ") || null,
  };
}

module.exports = {
  tableUuid,
  resolveEnvironmentBinding,
  verifyEnvironmentBinding,
};
