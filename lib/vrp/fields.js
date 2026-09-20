"use strict";

const crypto = require("crypto");
const { canonicalJson, inferCanonicalType } = require("./canonical");

/**
 * Resolve VRP identity/content columns. No silent default to ["id"].
 * When unset, hash all columns present in the workload (explicit opt-out via contentFields).
 * Paper N9 / Profile O: ordered datasets MUST include the sequence field in identity.
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

  const identityFields = Array.isArray(pvdmSpec.identityFields) ? [...pvdmSpec.identityFields] : allColumns;
  const contentFields = Array.isArray(pvdmSpec.contentFields) ? [...pvdmSpec.contentFields] : allColumns;

  for (const f of identityFields.concat(contentFields)) {
    if (!keys.has(f)) {
      return { identityFields, contentFields, error: `VRP field "${f}" not present in row schema` };
    }
  }

  const ordered = isOrderedProfile(pvdmSpec);
  const sequenceField = resolveSequenceField(pvdmSpec);
  if (ordered || sequenceField) {
    if (!sequenceField) {
      return {
        identityFields,
        contentFields,
        error: "Profile O requires an explicit sequence or version field in the identity projection (paper N9)",
      };
    }
    if (!keys.has(sequenceField)) {
      return {
        identityFields,
        contentFields,
        error: `Profile O sequence field "${sequenceField}" is not present in row schema`,
      };
    }
    if (!identityFields.includes(sequenceField)) {
      return {
        identityFields,
        contentFields,
        error: `Profile O sequence field "${sequenceField}" MUST be included in identityFields (paper N9)`,
      };
    }
  }

  return { identityFields, contentFields, sequenceField: sequenceField || null };
}

function isOrderedProfile(pvdmSpec = {}) {
  const profile = pvdmSpec.vrp?.profile || pvdmSpec.profile;
  return (
    profile === "O" ||
    pvdmSpec.vrp?.ordered === true ||
    pvdmSpec.ordered === true ||
    Boolean(resolveSequenceField(pvdmSpec))
  );
}

function resolveSequenceField(pvdmSpec = {}) {
  return (
    pvdmSpec.vrp?.sequenceField ||
    pvdmSpec.sequenceField ||
    pvdmSpec.vrp?.versionField ||
    pvdmSpec.versionField ||
    null
  );
}

function schemaFingerprint(rows, fields, fieldTypes = {}) {
  const sample = rows[0] || {};
  const types = {};
  for (const f of fields) {
    types[f] = inferCanonicalType(sample[f], fieldTypes[f]);
  }
  return crypto.createHash("sha256").update(canonicalJson(types)).digest("hex");
}

module.exports = { resolveVrpFields, schemaFingerprint, isOrderedProfile, resolveSequenceField };
