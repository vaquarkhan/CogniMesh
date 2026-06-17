"use strict";

const crypto = require("crypto");

/**
 * Coerce proof-bound values to JCS-safe primitives (numbers → decimal strings).
 */
function normalizeForProof(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("VRP proof payloads reject NaN/Infinity");
    return Number.isInteger(value) ? String(value) : value.toFixed(10).replace(/\.?0+$/, "");
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeForProof(v));
  }
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = normalizeForProof(value[k]);
    }
    return out;
  }
  throw new Error(`Unsupported type in VRP canonical payload: ${typeof value}`);
}

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) over normalized proof payloads.
 */
function canonicalJson(value) {
  const normalized = normalizeForProof(value);
  if (normalized === null || typeof normalized === "boolean" || typeof normalized === "string") {
    return JSON.stringify(normalized);
  }
  if (Array.isArray(normalized)) {
    return `[${normalized.map((v) => canonicalJson(v)).join(",")}]`;
  }
  if (typeof normalized === "object") {
    const keys = Object.keys(normalized).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(normalized[k])}`).join(",")}}`;
  }
  throw new Error(`Unsupported normalized type: ${typeof normalized}`);
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

module.exports = { normalizeForProof, canonicalJson, sha256Canonical };
