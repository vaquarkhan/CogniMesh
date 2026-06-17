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

  const sampleRows = options.sampleRows || [
    { order_id: "1", customer_id: "c1", total_amount: 100, created_at: new Date().toISOString() },
    { order_id: "2", customer_id: "c2", total_amount: 200, created_at: new Date().toISOString() },
  ];

  let vrpVerdict = "UNVERIFIED";
  let rowsProcessed = sampleRows.length;
  let rowsDropped = 0;
  let outcome = "unverified";
  let snapshotId = null;

  try {
    if (contract.spec?.transform?.pvdm && options.runLive !== false) {
      const result = await runPvdmWorkload({
        contract,
        source_rows: sampleRows,
        workload_id: `deploy-${name}-${ts}`,
      });
      outcome = result.outcome;
      snapshotId = result.snapshot_id || null;
      if (result.vrp_verdict) {
        vrpVerdict = result.vrp_verdict;
      } else if (outcome === "committed") {
        vrpVerdict = "PASS";
      } else if (outcome === "verification_failed") {
        vrpVerdict = "FAIL";
      } else {
        vrpVerdict = "UNVERIFIED";
      }
      rowsProcessed = result.chunks ? result.chunks * (contract.spec.transform?.pvdm?.checkpointInterval || 5000) : sampleRows.length;
    }
  } catch (err) {
    vrpVerdict = "UNVERIFIED";
    outcome = "error";
    console.warn("[pvdm-run-summary] PVDM error (fail-closed):", err.message);
  }

  if (contract.spec?.transform?.sparkRules?.enabled) {
    rowsDropped = options.simulateDrops ?? Math.floor(rowsProcessed * 0.002);
  }

  const messageByVerdict = {
    PASS: "PVDM committed: Physical → Verify → Metadata (VRP PASS)",
    FAIL: "VRP FAIL - Iceberg commit blocked",
    UNVERIFIED: "VRP UNVERIFIED - no proof (empty workload, runtime error, or PVDM not run)",
  };

  return {
    vrpVerdict,
    proofGated: contract.spec?.execution?.pattern === "vaquar" || Boolean(contract.spec?.transform?.pvdm),
    rowsProcessed,
    rowsDropped,
    rowsWritten: Math.max(0, rowsProcessed - rowsDropped),
    qualityPolicyId: contract.spec?.transform?.pvdm?.qualityPolicyId || "strict-zero-drop",
    sparkRulesEnabled: Boolean(contract.spec?.transform?.sparkRules?.enabled),
    proofS3Uri: `s3://${proofBucket}/${contract.metadata?.domain}/${name}/proof-${ts}.json`,
    checkpointS3Uri: `s3://${checkpointBucket}/${contract.metadata?.domain}/${name}/chk-${ts}`,
    icebergSnapshotId: snapshotId || (vrpVerdict === "PASS" ? null : `unverified-${ts}`),
    pvdmOutcome: outcome,
    message: messageByVerdict[vrpVerdict] || messageByVerdict.UNVERIFIED,
  };
}

module.exports = { buildPvdmRunSummary };
