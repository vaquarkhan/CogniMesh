"use strict";

const { runPvdmWorkload } = require("../../services/pvdm-runtime");

/**
 * Self-healing: on VRP FAIL, re-ingest dropped rows and re-verify.
 */
async function attemptSelfHeal({ contract, source_rows, workload_id, gateResult }) {
  if (!gateResult || gateResult.passed !== false) {
    return { healed: false, reason: "Integrity gate passed — no heal needed" };
  }

  const dropped = gateResult.warnings?.filter((w) => /drop|quarantine/i.test(w)) || [];
  if (!source_rows?.length) {
    return {
      healed: false,
      reason: "No source_rows provided for re-ingest",
      suggestion: "Invoke with failed chunk rows from VRP audit",
    };
  }

  const retry = await runPvdmWorkload({
    contract,
    source_rows,
    workload_id: workload_id || `heal-${Date.now()}`,
    resume_offset: 0,
  });

  return {
    healed: retry.outcome === "committed",
    outcome: retry.outcome,
    chunks: retry.chunks,
    message: retry.outcome === "committed"
      ? "Self-heal succeeded — VRP re-verified and committed"
      : "Self-heal attempted — manual review required",
    droppedRules: dropped,
  };
}

module.exports = { attemptSelfHeal };
