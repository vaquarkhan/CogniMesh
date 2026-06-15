"use strict";

const { listRuns } = require("./execution-history");

/**
 * Aggregate pipeline runs into portal-friendly observability metrics.
 */
function buildObservabilitySummary(runs) {
  const relevant = runs.filter((r) => r.outcome !== "backfill_queued");
  const total = relevant.length;
  const vrpPass = relevant.filter((r) => r.vrpVerdict === "PASS").length;
  const vrpFail = relevant.filter((r) => r.vrpVerdict === "FAIL").length;
  const proofGated = relevant.filter((r) => r.proofGated).length;
  const totalDropped = relevant.reduce((s, r) => s + (r.rowsDropped || 0), 0);
  const totalWritten = relevant.reduce((s, r) => s + (r.rowsWritten ?? r.rowsProcessed ?? 0), 0);
  const dropRate = totalWritten + totalDropped > 0 ? totalDropped / (totalWritten + totalDropped) : 0;

  const timeline = [...relevant]
    .reverse()
    .slice(-12)
    .map((r) => ({
      ts: r.ts,
      vrpVerdict: r.vrpVerdict || "UNKNOWN",
      rowsDropped: r.rowsDropped || 0,
      rowsWritten: r.rowsWritten ?? r.rowsProcessed ?? 0,
      proofGated: Boolean(r.proofGated),
      outcome: r.outcome,
    }));

  const dropTrend = timeline.map((t) => ({
    ts: t.ts,
    dropped: t.rowsDropped,
    dropPct: t.rowsWritten + t.rowsDropped > 0 ? t.rowsDropped / (t.rowsWritten + t.rowsDropped) : 0,
  }));

  const awsRuns = relevant.filter((r) => r.awsExecutionArn);
  const awsSucceeded = awsRuns.filter((r) => r.awsStatus === "SUCCEEDED" || r.awsStatus === "deployed").length;

  return {
    totalRuns: total,
    vrpPassRate: total ? vrpPass / total : null,
    vrpPass,
    vrpFail,
    proofGatedRuns: proofGated,
    totalRowsWritten: totalWritten,
    totalRowsDropped: totalDropped,
    avgDropRate: dropRate,
    timeline,
    dropTrend,
    aws: {
      deployedRuns: awsRuns.length,
      succeeded: awsSucceeded,
      lastStatus: awsRuns[0]?.awsStatus || null,
    },
    lastRun: relevant[0] || null,
  };
}

function pipelineObservability({ pipelineName, domain, limit = 20 } = {}) {
  const runs = listRuns({ pipelineName, domain, limit });
  return buildObservabilitySummary(runs);
}

module.exports = { buildObservabilitySummary, pipelineObservability };
