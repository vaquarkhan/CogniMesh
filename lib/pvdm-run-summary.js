"use strict";

const { runPvdmWorkload } = require("../services/pvdm-runtime");

/**
 * Build VRP / PVDM run summary for execution history and portal observability.
 */
async function buildPvdmRunSummary(contract, options = {}) {
  const prefix = process.env.AWS_NAME_PREFIX || `cognimesh-${contract.metadata?.domain || "default"}`;
  const name = contract.metadata?.name || "pipeline";
  const proofBucket = process.env.PROOF_BUCKET || `${prefix}-proofs`;
  const checkpointBucket = process.env.CHECKPOINT_BUCKET || `${prefix}-checkpoints`;
  const ts = Date.now();

  // Deploy-time VRP is a synthetic smoke test. The sample rows MUST contain the contract's
  // declared identity/content fields, otherwise resolveVrpFields refuses to default.
  const pvdmFields = contract.spec?.transform?.pvdm || {};
  const declaredFields = [
    ...(Array.isArray(pvdmFields.identityFields) ? pvdmFields.identityFields : []),
    ...(Array.isArray(pvdmFields.contentFields) ? pvdmFields.contentFields : []),
  ];
  const uniqueFields = [...new Set(declaredFields)];

  function syntheticRow(seed) {
    if (!uniqueFields.length) {
      return { order_id: String(seed), customer_id: `c${seed}`, total_amount: 100 * seed, created_at: new Date().toISOString() };
    }
    const row = {};
    for (const f of uniqueFields) row[f] = `${f}-${seed}`;
    return row;
  }

  const sampleRows = options.sampleRows || [syntheticRow(1), syntheticRow(2)];

  let vrpVerdict = "UNVERIFIED";
  let rowsProcessed = sampleRows.length;
  let rowsDropped = 0;
  let outcome = "unverified";
  let snapshotId = null;
  let proofS3Uri = null;
  let checkpointS3Uri = null;
  let signingError = null;

  const proofGated =
    contract.spec?.execution?.pattern === "vaquar" || Boolean(contract.spec?.transform?.pvdm);

  try {
    if (contract.spec?.transform?.pvdm && options.runLive !== false) {
      const result = await runPvdmWorkload({
        contract,
        source_rows: sampleRows,
        workload_id: `deploy-${name}-${ts}`,
      });
      outcome = result.outcome;
      snapshotId = result.snapshot_id || null;
      if (result.proofS3Uri) proofS3Uri = result.proofS3Uri;
      if (result.outcome === "signing_failed") {
        vrpVerdict = "FAIL";
        signingError = result.message;
      } else if (result.vrp_verdict) {
        vrpVerdict = result.vrp_verdict;
      } else if (outcome === "committed") {
        vrpVerdict = "PASS";
      } else if (outcome === "verification_failed") {
        vrpVerdict = "FAIL";
      } else {
        vrpVerdict = "UNVERIFIED";
      }
      rowsProcessed = result.chunks
        ? result.chunks * (contract.spec.transform?.pvdm?.checkpointInterval || 5000)
        : sampleRows.length;
      if (result.outcome === "committed" && result.proofPersisted) {
        checkpointS3Uri = `s3://${checkpointBucket}/${contract.metadata?.domain}/${name}/chk-${ts}`;
      }
    }
  } catch (err) {
    if (err.code === "SIGNING_FAILED") {
      vrpVerdict = "FAIL";
      outcome = "signing_failed";
      signingError = err.message;
    } else {
      vrpVerdict = "UNVERIFIED";
      outcome = "error";
    }
    console.warn("[pvdm-run-summary] PVDM error (fail-closed):", err.message);
  }

  if (contract.spec?.transform?.sparkRules?.enabled) {
    rowsDropped = options.simulateDrops ?? Math.floor(rowsProcessed * 0.002);
  }

  const messageByVerdict = {
    PASS: "PVDM committed: Physical → Verify → Metadata (VRP PASS)",
    FAIL: signingError || "VRP FAIL - Iceberg commit blocked",
    UNVERIFIED: "VRP UNVERIFIED - no proof (empty workload, runtime error, or PVDM not run)",
  };

  return {
    vrpVerdict,
    proofGated,
    rowsProcessed,
    rowsDropped,
    rowsWritten: Math.max(0, rowsProcessed - rowsDropped),
    qualityPolicyId: contract.spec?.transform?.pvdm?.qualityPolicyId || "strict-zero-drop",
    sparkRulesEnabled: Boolean(contract.spec?.transform?.sparkRules?.enabled),
    proofS3Uri,
    checkpointS3Uri,
    icebergSnapshotId: snapshotId,
    snapshotPinSql: snapshotId
      ? `SELECT * FROM ${contract.spec?.target?.catalog?.database || "default"}.${contract.spec?.target?.catalog?.table || "output"} FOR SYSTEM_VERSION AS OF ${snapshotId}`
      : null,
    pvdmOutcome: outcome,
    signingFailed: outcome === "signing_failed",
    message: messageByVerdict[vrpVerdict] || messageByVerdict.UNVERIFIED,
  };
}

module.exports = { buildPvdmRunSummary };
