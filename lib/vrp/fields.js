"use strict";

/**
 * Resolve VRP identity/content columns. No silent default to ["id"].
 * When unset, hash all columns present in the workload (explicit opt-out via contentFields).
 */
function resolveVrpFields(rows, pvdmSpec = {}) {
  const keys = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row || {})) keys.add(k);
  }
  const allColumns = [...keys].sort();

  if (!allColumns.length) {
    return { identityFields: [], contentFields: [], error: "No columns in workload rows" };
  }

  const identityFields = Array.isArray(pvdmSpec.identityFields) ? pvdmSpec.identityFields : allColumns;
  const contentFields = Array.isArray(pvdmSpec.contentFields) ? pvdmSpec.contentFields : allColumns;

  for (const f of identityFields.concat(contentFields)) {
    if (!keys.has(f)) {
      return { identityFields, contentFields, error: `VRP field "${f}" not present in row schema` };
    }
  }

  return { identityFields, contentFields };
}

function schemaFingerprint(rows, fields) {
  const crypto = require("crypto");
  const sample = rows[0] || {};
  const types = {};
  for (const f of fields) {
    const v = sample[f];
    types[f] = v == null ? "null" : typeof v === "number" ? "number" : "string";
  }
  const { canonicalJson } = require("./canonical");
  return crypto.createHash("sha256").update(canonicalJson(types)).digest("hex");
}

module.exports = { resolveVrpFields, schemaFingerprint };
