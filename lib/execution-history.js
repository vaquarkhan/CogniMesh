"use strict";

const { readStore, writeStore } = require("./platform/platform-store");

const STORE_KEY = "execution-runs";
const MAX = 200;
const runs = [];

function reloadExecutionRuns() {
  runs.length = 0;
  const stored = readStore(STORE_KEY, []);
  if (Array.isArray(stored)) {
    for (const row of stored.slice(0, MAX)) runs.push(row);
  }
}

function persistRuns() {
  if (process.env.EXECUTION_HISTORY_PERSIST === "false") return;
  writeStore(STORE_KEY, runs.slice(0, MAX));
}

reloadExecutionRuns();

function recordRun(entry) {
  const row = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  runs.unshift(row);
  if (runs.length > MAX) runs.length = MAX;
  persistRuns();
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

module.exports = { recordRun, listRuns, stats, reloadExecutionRuns, STORE_KEY };
