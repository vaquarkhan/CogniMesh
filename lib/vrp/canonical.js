"use strict";

const crypto = require("crypto");

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 * Restricted to JSON-safe proof payloads (no float / undefined).
 */
function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error("VRP proof payloads must use integers-as-strings, not floats");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  throw new Error(`Unsupported type in VRP canonical payload: ${typeof value}`);
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

module.exports = { canonicalJson, sha256Canonical };
