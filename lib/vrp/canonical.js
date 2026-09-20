"use strict";

const crypto = require("crypto");

/** Paper Appendix A: nulls MUST be distinct from empty string and zero. */
const NULL_SENTINEL = "\u0000PVDM_NULL";

/**
 * Coerce proof-bound values to JCS-safe primitives (numbers → decimal strings).
 * Strings are Unicode NFC (paper Appendix A).
 */
function normalizeForProof(value) {
  if (value === null) return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
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

function encodeInteger(value) {
  const asBig = typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value)));
  if (asBig === 0n) return "0";
  return asBig.toString(10);
}

function encodeDecimal(value, scale) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) throw new Error("VRP hashed projections reject NaN/Infinity");
  if (Number.isInteger(scale) && scale >= 0) {
    return num.toFixed(scale);
  }
  return Number.isInteger(num) ? String(num) : num.toFixed(10).replace(/\.?0+$/, "");
}

function encodeTimestampMicros(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("invalid timestamp for hashed projection");
  return String(Math.trunc(d.getTime() * 1000));
}

function fieldTypeName(fieldType) {
  if (!fieldType) return "";
  if (typeof fieldType === "string") return fieldType.toLowerCase();
  return String(fieldType.type || "").toLowerCase();
}

/**
 * Paper Appendix A typed encoding for a single hashed field.
 * Raw IEEE-754 bits are never hashed; floats round to a declared (or default) decimal scale.
 */
function encodeHashedField(value, fieldType = {}) {
  if (value === null || value === undefined) return NULL_SENTINEL;
  const type = fieldTypeName(fieldType);
  const scale = typeof fieldType === "object" ? fieldType.scale : undefined;

  if (value instanceof Date || type === "timestamp" || type === "timestamptz" || type === "datetime") {
    return encodeTimestampMicros(value);
  }
  if (typeof value === "boolean" || type === "boolean") {
    return value ? "true" : "false";
  }
  if (type === "integer" || type === "long" || type === "int") {
    return encodeInteger(value);
  }
  if (type === "decimal" || type === "numeric" || type === "money") {
    return encodeDecimal(value, Number.isInteger(scale) ? scale : 10);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("VRP hashed projections reject NaN/Infinity");
    if (Number.isInteger(value)) return encodeInteger(value);
    return encodeDecimal(value, Number.isInteger(scale) ? scale : 10);
  }
  if (typeof value === "string") {
    if ((type === "decimal" || type === "numeric" || type === "money") && /^-?\d+(\.\d+)?$/.test(value)) {
      return encodeDecimal(value, Number.isInteger(scale) ? scale : undefined);
    }
    return value.normalize("NFC");
  }
  if (Array.isArray(value) || (typeof value === "object" && value)) {
    return encodeHashedProjection(value, fieldType.fields || {});
  }
  return String(value).normalize("NFC");
}

function encodeHashedProjection(row, fieldTypes = {}) {
  if (Array.isArray(row)) {
    return row.map((item) => encodeHashedField(item, {}));
  }
  const keys = Object.keys(row || {}).sort();
  const out = {};
  for (const k of keys) {
    out[k] = encodeHashedField(row[k], fieldTypes[k]);
  }
  return out;
}

function inferCanonicalType(value, fieldType) {
  const declared = fieldTypeName(fieldType);
  if (declared) return declared;
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "timestamp";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "decimal";
  if (typeof value === "string" && /^-?\d+$/.test(value)) return "integer";
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value)) return "decimal";
  return "string";
}

module.exports = {
  NULL_SENTINEL,
  normalizeForProof,
  canonicalJson,
  sha256Canonical,
  encodeHashedField,
  encodeHashedProjection,
  inferCanonicalType,
  encodeTimestampMicros,
};
