"use strict";

const crypto = require("crypto");

const DEFAULT_DEV_VRP_MATERIAL = "cognimesh-dev-steward-vrp-key";
const DEFAULT_DEV_SIGN_MATERIAL = "cognimesh-dev-steward-sign-key";

function parseKey(raw, label) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length >= 32) {
    return Buffer.from(trimmed, "hex");
  }
  return crypto.createHash("sha256").update(`${label}:${trimmed}`).digest();
}

function allowDevStewardKeys() {
  return (
    process.env.VRP_SIGNING_MODE === "dev" ||
    process.env.VRP_SIGNING_MODE === "local" ||
    process.env.VRP_SIGN_ON_GENERATE === "false" ||
    process.env.NODE_ENV === "test"
  );
}

/**
 * Steward-held HMAC key for MSet-Add-Hash (paper N1/N2).
 * Never derived from producer-controlled proof fields.
 */
function resolveStewardVrpKey(options = {}) {
  if (options.vrpKey) {
    return Buffer.isBuffer(options.vrpKey) ? options.vrpKey : parseKey(options.vrpKey, "vrp");
  }
  const fromEnv = parseKey(process.env.PVDM_STEWARD_VRP_KEY, "vrp");
  if (fromEnv) return fromEnv;
  if (process.env.VRP_SIGNING_MODE === "kms" || process.env.PVDM_REQUIRE_STEWARD_KEY === "true") {
    const err = new Error("PVDM_STEWARD_VRP_KEY required — Steward HMAC key must not be producer-held");
    err.code = "STEWARD_KEY_MISSING";
    throw err;
  }
  return crypto.createHash("sha256").update(DEFAULT_DEV_VRP_MATERIAL).digest();
}

function resolveStewardSignKey(options = {}) {
  if (options.stewardSignKey) {
    return Buffer.isBuffer(options.stewardSignKey)
      ? options.stewardSignKey
      : parseKey(options.stewardSignKey, "sign");
  }
  const fromEnv = parseKey(process.env.PVDM_STEWARD_SIGNING_KEY, "sign");
  if (fromEnv) return fromEnv;
  if (allowDevStewardKeys()) {
    return crypto.createHash("sha256").update(DEFAULT_DEV_SIGN_MATERIAL).digest();
  }
  return null;
}

function stewardKeyEpoch() {
  return process.env.PVDM_KEY_EPOCH || "e1";
}

module.exports = {
  resolveStewardVrpKey,
  resolveStewardSignKey,
  stewardKeyEpoch,
  allowDevStewardKeys,
};
