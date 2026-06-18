"use strict";

const { sha256Canonical } = require("./canonical");
const { parseTransformSpec } = require("./transform-verify");

function transformContentHash(pvdmSpec = {}) {
  const spec = parseTransformSpec(pvdmSpec);
  const vrp = pvdmSpec.vrp || {};
  return sha256Canonical({
    mode: spec.mode,
    groupBy: spec.groupBy,
    amountField: spec.amountField,
    feeMultiplier: spec.feeMultiplier,
    moneyFields: spec.moneyFields,
    numericTolerance: spec.numericTolerance,
    transformExpression: spec.transformExpression || vrp.sparkSql || null,
  });
}

function buildReproducibleClaim(options = {}) {
  const {
    transformHash,
    inputProofIds = [],
    outputLogicalHash,
    pipelineRunId,
  } = options;
  return {
    claim_version: "1",
    statement:
      "output is the deterministic result of transform T over signed inputs I",
    transform_content_hash: transformHash,
    input_proof_ids: inputProofIds,
    output_logical_hash: outputLogicalHash,
    pipeline_run_id: pipelineRunId,
  };
}

module.exports = { transformContentHash, buildReproducibleClaim };
