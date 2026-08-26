#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.VRP_FORCE_NDJSON = "true";
process.env.ICEBERG_SNAPSHOT_STATE = require("path").join(
  require("os").tmpdir(),
  `iceberg-snapshots-resume-${process.pid}.json`
);

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { runPvdmWorkload, IceGuardWriter } = require("../../services/pvdm-runtime");
const { compileVaquarStateMachine } = require("../vaquar/pvdm-sfn");

function contract(chunkSize = 2) {
  return {
    metadata: { name: "resume-demo", domain: "commerce", version: "1.0.0" },
    spec: {
      transform: {
        pvdm: {
          identityFields: ["id"],
          contentFields: ["id", "v"],
          maxChunkRecords: chunkSize,
        },
      },
      target: {
        location: "s3://staging/",
        catalog: { database: "d", table: "resume_t" },
      },
    },
  };
}

describe("PVDM resume loop", () => {
  it("Durable timeout then resume on the same workload_id publishes once", async () => {
    const rows = [
      { id: "1", v: 1 },
      { id: "2", v: 2 },
      { id: "3", v: 3 },
      { id: "4", v: 4 },
    ];
    const c = contract(2);
    let budgetCalls = 0;
    const first = await runPvdmWorkload({
      contract: c,
      source_rows: rows,
      workload_id: "resume-full",
      resume_offset: 0,
      getRemainingMs: () => {
        budgetCalls += 1;
        return budgetCalls <= 1 ? 120000 : 500;
      },
    });
    assert.equal(first.outcome, "rolled_back");
    assert.equal(first.resume_offset, 2);

    const tail = await runPvdmWorkload({
      contract: c,
      source_rows: rows,
      workload_id: "resume-full",
      resume_offset: first.resume_offset,
    });
    assert.equal(tail.outcome, "committed");
    assert.equal(tail.chunks, 2);
  });

  it("IceGuard timeout surfaces rolled_back with next resume_offset after partial commit", async () => {
    const w = new IceGuardWriter({ isolationId: "partial" });
    await w.writeChunk(0, [{ id: "1" }], "s3://s");
    w.commitChunk(0);
    await w.writeChunk(1, [{ id: "2" }], "s3://s");
    const rb = w.rollback();
    assert.equal(rb.rolledBack, 1);
    assert.equal(w.nextResumeOffset(2, 0), 2);
  });

  it("compiled ASL passes resume_offset into next Domain Writer payload", () => {
    const sm = compileVaquarStateMachine(contract(), {
      accountId: "111122223333",
      region: "us-east-1",
      namePrefix: "cognimesh-dev",
    });
    assert.equal(
      sm.States.IncrementResumeAttempt.Parameters.workload["resume_offset.$"],
      "$.result.Payload.resume_offset"
    );
    assert.equal(sm.States.WaitBeforeResume.Next, "InvokeDomainWriter");
  });
});
