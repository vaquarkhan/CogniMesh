"use strict";

const { sha256Canonical } = require("./canonical");
const { hashMultiset } = require("./multiset");
const { sumMinor, scaleMinor } = require("./money");
const { buildRowMerkle, localizeDivergence, hashKeyPII } = require("./merkle");

function parseTransformSpec(pvdmSpec = {}) {
  const vrp = pvdmSpec.vrp || {};
  const mode = vrp.mode || pvdmSpec.vrpMode || "identity";
  return {
    mode,
    groupBy: vrp.groupBy || pvdmSpec.groupBy || [],
    amountField: vrp.amountField || "amount",
    feeMultiplier: String(vrp.feeMultiplier ?? vrp.multiplier ?? "1"),
    moneyFields: vrp.moneyFields || [vrp.amountField || "amount"],
    numericTolerance: String(vrp.numericTolerance ?? "0"),
    identityField: vrp.identityField || "id",
    transformExpression: vrp.transformExpression || null,
  };
}

function deriveInvariantChecks(spec, sourceRows, sinkRows) {
  const amountField = spec.amountField;
  const tolerance = BigInt(spec.numericTolerance || "0");
  const sourceSum = sumMinor(sourceRows, amountField, spec.moneyFields);
  const sinkSum = sumMinor(sinkRows, amountField, spec.moneyFields);
  const expected = scaleMinor(sourceSum, spec.feeMultiplier);
  const diff = sinkSum > expected ? sinkSum - expected : expected - sinkSum;
  const sumCheck = {
    id: "derived_sum",
    expression: `SUM(${amountField}) * ${spec.feeMultiplier}`,
    source_value: String(sourceSum),
    expected_sink_value: String(expected),
    actual_sink_value: String(sinkSum),
    tolerance: String(tolerance),
    pass: diff <= tolerance,
  };

  const checks = [sumCheck];

  if (spec.mode === "identity") {
    checks.push({
      id: "row_count",
      expression: "COUNT(source) == COUNT(sink)",
      source_value: String(sourceRows.length),
      expected_sink_value: String(sourceRows.length),
      actual_sink_value: String(sinkRows.length),
      tolerance: "0",
      pass: sourceRows.length === sinkRows.length,
    });
  } else if (spec.groupBy.length) {
    const tolerance = BigInt(spec.numericTolerance || "0");
    const sinkByGroup = {};
    for (const row of sinkRows) {
      const gk = spec.groupBy.map((f) => String(row[f] ?? "")).join("|");
      sinkByGroup[gk] = row;
    }
    for (const row of sourceRows) {
      const gk = spec.groupBy.map((f) => String(row[f] ?? "")).join("|");
      if (!sinkByGroup[gk]) continue;
    }
    const groupKeys = [...new Set(sourceRows.map((r) => spec.groupBy.map((f) => String(r[f] ?? "")).join("|")))];
    for (const gk of groupKeys) {
      const srcInGroup = sourceRows.filter((r) => spec.groupBy.map((f) => String(r[f] ?? "")).join("|") === gk);
      const srcSum = sumMinor(srcInGroup, amountField, spec.moneyFields);
      const expected = scaleMinor(srcSum, spec.feeMultiplier);
      const sinkRow = sinkByGroup[gk];
      const actual = sinkRow ? sumMinor([sinkRow], amountField, spec.moneyFields) : 0n;
      const diff = actual > expected ? actual - expected : expected - actual;
      checks.push({
        id: `group_sum:${gk}`,
        expression: `SUM(${amountField}|group=${gk}) * ${spec.feeMultiplier}`,
        source_value: String(srcSum),
        expected_sink_value: String(expected),
        actual_sink_value: String(actual),
        tolerance: String(tolerance),
        pass: diff <= tolerance,
      });
    }
  }

  return checks;
}

function computePerGroupLineage(sourceRows, sinkRows, spec) {
  if (!spec.groupBy?.length) return { pass: true, groups: {}, reason: null };

  const sourceMap = {};
  for (const row of sourceRows) {
    const gk = spec.groupBy.map((f) => String(row[f] ?? "")).join("|");
    if (!sourceMap[gk]) sourceMap[gk] = [];
    const idKey = String(row[spec.identityField] ?? row[spec.groupBy[0]] ?? "");
    sourceMap[gk].push(hashKeyPII(idKey));
  }

  const groups = {};
  let pass = true;
  for (const [gk, keyHashes] of Object.entries(sourceMap)) {
    const sorted = [...keyHashes].sort();
    groups[gk] = {
      input_key_hashes: sorted,
      lineage_hash: sha256Canonical(sorted),
    };
  }

  for (const sinkRow of sinkRows) {
    const gk = spec.groupBy.map((f) => String(sinkRow[f] ?? "")).join("|");
    const expected = groups[gk];
    if (!expected) {
      pass = false;
      groups[gk] = { error: "sink group not in source", lineage_hash: null };
    }
  }

  return { pass, groups, reason: pass ? null : "per-group lineage mismatch" };
}

function attachSinkLineage(sinkRows, sourceRows, spec) {
  const { groups } = computePerGroupLineage(sourceRows, sinkRows, spec);
  return sinkRows.map((row) => {
    const gk = spec.groupBy.map((f) => String(row[f] ?? "")).join("|");
    return { ...row, _lineage_hash: groups[gk]?.lineage_hash || null };
  });
}

/**
 * Verify transform: identity multiset OR aggregate invariants + per-group lineage.
 */
function runTransformVerification(sourceRows, sinkRows, pvdmSpec = {}, hashFields = []) {
  const spec = parseTransformSpec(pvdmSpec);
  const invariants = deriveInvariantChecks(spec, sourceRows, sinkRows);
  const lineage = computePerGroupLineage(sourceRows, sinkRows, spec);

  let pass = invariants.every((c) => c.pass) && lineage.pass;

  if (spec.mode === "identity") {
    const sourceHash = hashMultiset(sourceRows, hashFields);
    const sinkHash = hashMultiset(sinkRows, hashFields);
    if (sourceHash !== sinkHash) pass = false;
  }

  let divergence = null;
  if (!pass) {
    const sourceMerkle = buildRowMerkle(sourceRows, hashFields);
    const sinkMerkle = buildRowMerkle(sinkRows, hashFields);
    divergence = localizeDivergence(sourceMerkle.leaves, sinkMerkle.leaves);
    divergence.offending_key_hashes = sourceRows.slice(0, 5).map((r) =>
      hashKeyPII(hashFields.map((f) => r[f]).join("|"))
    );
    divergence.message = lineage.reason || invariants.find((c) => !c.pass)?.id || "multiset_mismatch";
  }

  return {
    pass,
    spec,
    invariants,
    group_lineage: lineage.groups,
    group_lineage_hash: sha256Canonical(lineage.groups),
    transform_mode: spec.mode,
    divergence,
  };
}

function verifyTransformFromProof(proof, sourceRows, sinkRows, pvdmSpec, hashFields) {
  const stored = proof.transform_verification;
  if (!stored) {
    return { valid: true, skipped: true, reason: "no transform_verification in proof (v2)" };
  }
  const live = runTransformVerification(sourceRows, sinkRows, pvdmSpec, hashFields);
  const invariantsMatch = stored.invariants?.every((s, i) => {
    const l = live.invariants[i];
    return l && s.id === l.id && s.pass === l.pass && s.expected_sink_value === l.expected_sink_value;
  });
  const lineageMatch = stored.group_lineage_hash === sha256Canonical(live.group_lineage);
  const valid = live.pass && invariantsMatch && lineageMatch;
  return {
    valid,
    reason: valid ? null : live.divergence?.message || "transform verification mismatch",
    divergence: live.divergence,
  };
}

module.exports = {
  parseTransformSpec,
  deriveInvariantChecks,
  computePerGroupLineage,
  attachSinkLineage,
  runTransformVerification,
  verifyTransformFromProof,
};
