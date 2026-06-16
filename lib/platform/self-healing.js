"use strict";

const { runPvdmWorkload } = require("../../services/pvdm-runtime");
const { listRuns } = require("../execution-history");
const { getLatestPipelineVersion } = require("./pipeline-versions");
const { previewSourceData } = require("./data-preview");

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

async function selfHealPipeline({ domain, pipelineName }) {
  const latest = getLatestPipelineVersion(domain, pipelineName);
  if (!latest?.contract) {
    return { healed: false, errors: ["No saved pipeline version — deploy once first"] };
  }

  const runs = listRuns({ pipelineName, domain, limit: 5 });
  const failed = runs.find((r) => r.vrpVerdict === "FAIL" || r.outcome === "verification_failed");
  if (!failed) {
    return { healed: false, reason: "No failed VRP run found for this pipeline" };
  }

  const preview = await previewSourceData(latest.contract, { limit: 20 });
  const source_rows = preview.rows || [];
  if (!source_rows.length) {
    return { healed: false, errors: ["Could not build source rows for re-ingest"] };
  }

  return attemptSelfHeal({
    contract: latest.contract,
    source_rows,
    workload_id: `heal-${pipelineName}-${Date.now()}`,
    gateResult: { passed: false, warnings: ["VRP FAIL — self-heal retry"] },
  });
}

module.exports = { attemptSelfHeal, selfHealPipeline };
