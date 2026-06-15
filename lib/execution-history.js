"use strict";

const MAX = 200;
const runs = [];

function recordRun(entry) {
  const row = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  runs.unshift(row);
  if (runs.length > MAX) runs.pop();
  return row;
}

function listRuns({ pipelineName, domain, limit = 20 } = {}) {
  return runs
    .filter((r) => {
      if (pipelineName && r.pipelineName !== pipelineName) return false;
      if (domain && r.domain !== domain) return false;
      return true;
    })
    .slice(0, limit);
}

function stats() {
  const succeeded = runs.filter((r) => r.outcome === "success").length;
  return {
    total: runs.length,
    succeeded,
    failed: runs.length - succeeded,
    lastRunAt: runs[0]?.ts || null,
  };
}

module.exports = { recordRun, listRuns, stats };
