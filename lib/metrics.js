"use strict";

const counters = {
  http_requests: 0,
  deploy_success: 0,
  deploy_failed: 0,
  preview_success: 0,
  preview_failed: 0,
  lineage_registered: 0,
};

function inc(name, n = 1) {
  if (counters[name] !== undefined) counters[name] += n;
}

function snapshot(extra = {}) {
  return {
    ts: new Date().toISOString(),
    counters: { ...counters },
    ...extra,
  };
}

module.exports = { inc, snapshot, counters };
