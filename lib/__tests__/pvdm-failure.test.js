#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateVRP,
  validateThenCommit,
  IceGuardWriter,
  runPvdmWorkload,
} = require("../../services/pvdm-runtime");

describe("pvdm failure paths", () => {
  it("validateThenCommit blocks FAIL verdict", () => {
    assert.throws(
      () => validateThenCommit({ verdict: "FAIL", proof: {} }),
      /VRP validation failed/
    );
  });

  it("generateVRP detects hash mismatch", () => {
    const source = [{ id: "1", amount: 10 }];
    const sink = [{ id: "1", amount: 99 }];
    const vrp = generateVRP(source, sink, ["id"], ["id", "amount"]);
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
  });

  it("IceGuardWriter rollback clears uncommitted checkpoints", () => {
    const w = new IceGuardWriter();
    w.writeChunk(0, [{ a: 1 }], "s3://staging");
    w.writeChunk(1, [{ a: 2 }], "s3://staging");
    w.commitChunk(0);
    const rb = w.rollback();
    assert.equal(rb.rolledBack, 1);
  });
});
