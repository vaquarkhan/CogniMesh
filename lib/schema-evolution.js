"use strict";

/**
 * Schema evolution evaluation for DataContract version upgrades.
 */

const POLICIES = ["strict", "compatible", "ignore"];

function columnMap(schema) {
  return new Map((schema || []).map((c) => [c.name, c]));
}

function diffSchemas(previousSchema, nextSchema) {
  const prev = columnMap(previousSchema);
  const next = columnMap(nextSchema);
  const added = [...next.keys()].filter((k) => !prev.has(k));
  const removed = [...prev.keys()].filter((k) => !next.has(k));
  const typeChanged = [...next.keys()].filter(
    (k) => prev.has(k) && prev.get(k).type !== next.get(k).type
  );
  const piiChanged = [...next.keys()].filter(
    (k) => prev.has(k) && Boolean(prev.get(k).pii) !== Boolean(next.get(k).pii)
  );
  return { added, removed, typeChanged, piiChanged };
}

function evaluateSchemaEvolution(previousContract, nextContract) {
  const policy =
    nextContract?.spec?.schemaEvolution?.policy ||
    previousContract?.spec?.schemaEvolution?.policy ||
    "compatible";

  if (!POLICIES.includes(policy)) {
    return {
      allowed: false,
      policy,
      errors: [`Unknown schema evolution policy: ${policy}`],
      diff: null,
    };
  }

  if (policy === "ignore") {
    return { allowed: true, policy, warnings: [], diff: null, skipped: true };
  }

  const diff = diffSchemas(
    previousContract?.spec?.source?.schema,
    nextContract?.spec?.source?.schema
  );

  const errors = [];
  const warnings = [];

  if (policy === "strict") {
    if (diff.added.length) errors.push(`Strict policy: new columns not allowed: ${diff.added.join(", ")}`);
    if (diff.removed.length) errors.push(`Strict policy: removed columns: ${diff.removed.join(", ")}`);
    if (diff.typeChanged.length) errors.push(`Strict policy: type changes: ${diff.typeChanged.join(", ")}`);
  }

  if (policy === "compatible") {
    if (diff.removed.length) {
      errors.push(`Compatible policy: removed columns require major version bump: ${diff.removed.join(", ")}`);
    }
    if (diff.typeChanged.length) {
      errors.push(`Compatible policy: type changes not allowed: ${diff.typeChanged.join(", ")}`);
    }
    if (diff.added.length) {
      warnings.push(`New nullable columns will be added: ${diff.added.join(", ")}`);
    }
    if (diff.piiChanged.length) {
      warnings.push(`PII flag changed on: ${diff.piiChanged.join(", ")} - review governance`);
    }
  }

  return {
    allowed: errors.length === 0,
    policy,
    diff,
    errors,
    warnings,
  };
}

module.exports = {
  diffSchemas,
  evaluateSchemaEvolution,
  POLICIES,
};
