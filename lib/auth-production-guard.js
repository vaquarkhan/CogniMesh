"use strict";

/**
 * Refuse to start (or serve) with auth disabled in production.
 */
function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function assertProductionAuthConfig() {
  if (!isProductionRuntime()) return;

  if (process.env.AUTH_DISABLED === "true") {
    throw new Error(
      "AUTH_DISABLED=true is not allowed when NODE_ENV=production. Remove AUTH_DISABLED or set NODE_ENV."
    );
  }

  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
    throw new Error(
      "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required when NODE_ENV=production."
    );
  }
}

function exitOnProductionAuthMisconfig() {
  try {
    assertProductionAuthConfig();
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  isProductionRuntime,
  assertProductionAuthConfig,
  exitOnProductionAuthMisconfig,
};
