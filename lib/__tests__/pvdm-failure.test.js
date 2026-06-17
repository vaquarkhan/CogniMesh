#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateVRP,
  validateThenCommit,
  IceGuardWriter,
  runPvdmWorkload,
  applySparkRules,
} = require("../../services/pvdm-runtime");

describe("pvdm failure paths", () => {
  it("validateThenCommit blocks FAIL verdict", () => {
    assert.throws(
      () => validateThenCommit({ verdict: "FAIL", proof: {} }),
      /VRP validation failed/
    );
  });

  it("generateVRP detects hash mismatch", async () => {
    const source = [{ id: "1", amount: 10 }];
    const sink = [{ id: "1", amount: 99 }];
    const vrp = await generateVRP(source, sink, ["id"], ["id", "amount"]);
    assert.equal(vrp.verdict, "FAIL");
  });

  it("runPvdmWorkload returns committed for valid rows", async () => {
    const contract = {
      spec: {
        transform: {
          pvdm: { identityFields: ["id"], contentFields: ["id", "v"] },
        },
        target: { location: "s3://test/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 1 }],
      workload_id: "ok-test",
    });
    assert.equal(result.outcome, "committed");
    assert.match(result.snapshot_id, /^[0-9a-f-]{36}$/i);
  });

  it("IceGuardWriter rollback clears uncommitted checkpoints", () => {
    const w = new IceGuardWriter();
    w.writeChunk(0, [{ a: 1 }], "s3://staging");
    w.writeChunk(1, [{ a: 2 }], "s3://staging");
    w.commitChunk(0);
    const rb = w.rollback();
    assert.equal(rb.rolledBack, 1);
  });

  it("applySparkRules drops rows with null identity under strict-zero-drop", () => {
    const rows = [
      { id: "1", v: 10 },
      { id: null, v: 20 },
      { id: "", v: 30 },
    ];
    const { records, audit } = applySparkRules(rows, {
      qualityPolicyId: "strict-zero-drop",
      identityFields: ["id"],
      contentFields: ["id", "v"],
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].id, "1");
    assert.equal(audit.dropped, 2);
  });

  it("applySparkRules audit-only does not drop rows", () => {
    const rows = [{ id: null, v: 1 }];
    const { records, audit } = applySparkRules(rows, {
      qualityPolicyId: "audit-only",
      identityFields: ["id"],
    });
    assert.equal(records.length, 1);
    assert.equal(audit.violations, 1);
  });
});
