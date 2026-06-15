#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildObservabilitySummary } = require("../execution-observability");

describe("execution-observability", () => {
  it("computes VRP pass rate and drop trend", () => {
    const summary = buildObservabilitySummary([
      { outcome: "success", vrpVerdict: "PASS", rowsWritten: 100, rowsDropped: 2, proofGated: true, ts: "2026-06-01T10:00:00Z" },
      { outcome: "verification_failed", vrpVerdict: "FAIL", rowsWritten: 0, rowsDropped: 5, proofGated: true, ts: "2026-06-02T10:00:00Z" },
      { outcome: "backfill_queued", message: "ignored" },
    ]);
    assert.equal(summary.totalRuns, 2);
    assert.equal(summary.vrpPass, 1);
    assert.equal(summary.vrpFail, 1);
    assert.equal(summary.vrpPassRate, 0.5);
    assert.equal(summary.totalRowsDropped, 7);
    assert.equal(summary.timeline.length, 2);
  });
});
