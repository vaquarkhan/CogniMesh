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
  it("second invoke with advanced resume_offset commits remaining rows", async () => {
    const rows = [
      { id: "1", v: 1 },
      { id: "2", v: 2 },
      { id: "3", v: 3 },
      { id: "4", v: 4 },
    ];
    const c = contract(2);

    const full = await runPvdmWorkload({
      contract: c,
      source_rows: rows,
      workload_id: "resume-full",
      resume_offset: 0,
    });
    assert.equal(full.outcome, "committed");
    assert.equal(full.chunks, 2);

    const tail = await runPvdmWorkload({
      contract: c,
      source_rows: rows,
      workload_id: "resume-tail",
      resume_offset: 2,
    });
    assert.equal(tail.outcome, "committed");
    assert.equal(tail.chunks, 1);
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
