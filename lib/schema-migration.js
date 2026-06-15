"use strict";

/**
 * DataContract apiVersion migration helpers.
 * v2 is not yet supported — callers get an explicit upgrade path message.
 */

const SUPPORTED_VERSIONS = new Set(["cognimesh.io/v1"]);
const FUTURE_VERSION = "cognimesh.io/v2";

function getApiVersion(contract) {
  return contract?.apiVersion || null;
}

function isSupportedVersion(apiVersion) {
  return SUPPORTED_VERSIONS.has(apiVersion);
}

function migrationMessage(apiVersion) {
  if (apiVersion === FUTURE_VERSION) {
    return (
      "cognimesh.io/v2 is not yet supported. Stay on cognimesh.io/v1 or bump the portal/compiler " +
      "before deploying v2 contracts."
    );
  }
  return `Unsupported apiVersion: ${apiVersion}. Supported: ${[...SUPPORTED_VERSIONS].join(", ")}`;
}

/** Validate version and return structured result for deploy/preview gates */
function checkApiVersionMigration(contract) {
  const apiVersion = getApiVersion(contract);
  if (!apiVersion) {
    return { allowed: false, apiVersion: null, errors: ["apiVersion is required"] };
  }
  if (isSupportedVersion(apiVersion)) {
    return { allowed: true, apiVersion, errors: [] };
  }
  return {
    allowed: false,
    apiVersion,
    errors: [migrationMessage(apiVersion)],
    upgradeHint: apiVersion === FUTURE_VERSION ? "v2-migration-not-available" : "unsupported-version",
  };
}

/**
 * Placeholder for future v1 → v2 transform. Throws until v2 schema lands.
 */
function migrateV1ToV2(_contract) {
  throw new Error(migrationMessage(FUTURE_VERSION));
}

module.exports = {
  SUPPORTED_VERSIONS,
  FUTURE_VERSION,
  getApiVersion,
  isSupportedVersion,
  migrationMessage,
  checkApiVersionMigration,
  migrateV1ToV2,
};
