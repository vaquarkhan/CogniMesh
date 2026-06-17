#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { canonicalJson, sha256Canonical, normalizeForProof } = require("../vrp/canonical");
const { writeChunkRecords, readChunkRecords } = require("../vrp/chunk-store");
const { generateVRP } = require("../vrp/generate");
const { verifyVrpProof } = require("../vrp/verify");
const { buildPvdmRunSummary } = require("../pvdm-run-summary");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");

describe("VRP sink read-back and proof honesty", () => {
  it("canonicalJson coerces floats to decimal strings", () => {
    const normalized = normalizeForProof({ amount: 100.5, count: 3 });
    assert.equal(normalized.amount, "100.5");
    assert.equal(normalized.count, "3");
    const json = canonicalJson({ amount: 100.5 });
    assert.equal(json, '{"amount":"100.5"}');
  });

  it("sink hash uses read-back rows not shallow copy", async () => {
    const rows = [{ id: "1", v: 10 }];
    const { localPath, sha256, parquetUri } = writeChunkRecords(0, rows, "s3://bucket");
    const readBack = readChunkRecords(localPath);
    readBack.rows[0].v = 99;
    fs.writeFileSync(localPath, `${JSON.stringify(readBack.rows[0])}\n`, "utf8");
    const tampered = readChunkRecords(localPath);

    const vrp = await generateVRP(rows, tampered.rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      parquetUri,
      sinkFileDigest: { sha256: tampered.sha256, row_count: tampered.rows.length },
      icebergSnapshotId: "999",
      sign: false,
    });
    assert.equal(vrp.verdict, "FAIL");
  });

  it("runPvdmWorkload VRP passes only after durable read-back", async () => {
    const contract = {
      metadata: { name: "rb", domain: "d" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://t/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 1 }],
      workload_id: "readback-test",
    });
    assert.equal(result.outcome, "committed");
    assert.equal(result.proof.multiset.sink_materialization, "read_back");
    assert.ok(result.proof.iceberg_snapshot_id);
    const verified = verifyVrpProof(result.proof, { requireSignature: false });
    assert.equal(verified.valid, true, verified.reason);
  });

  it("buildPvdmRunSummary omits proof URI when PVDM not run", async () => {
    const summary = await buildPvdmRunSummary(
      {
        metadata: { name: "x", domain: "d" },
        spec: { execution: { pattern: "vaquar" }, transform: { pvdm: {} } },
      },
      { runLive: false }
    );
    assert.equal(summary.proofS3Uri, null);
    assert.equal(summary.vrpVerdict, "UNVERIFIED");
  });

  it("buildPvdmRunSummary includes proof URI only when proof persisted", async () => {
    process.env.VRP_SIGN_ON_GENERATE = "true";
    const summary = await buildPvdmRunSummary({
      metadata: { name: "persist", domain: "commerce" },
      spec: {
        execution: { pattern: "vaquar" },
        transform: { pvdm: { identityFields: ["order_id"], contentFields: ["order_id", "total_amount"] } },
        target: { catalog: { database: "d", table: "t" }, location: "s3://x/" },
      },
    });
    if (summary.vrpVerdict === "PASS") {
      assert.ok(summary.proofS3Uri);
      assert.ok(summary.icebergSnapshotId);
      assert.ok(summary.snapshotPinSql.includes("FOR SYSTEM_VERSION"));
    }
    process.env.VRP_SIGN_ON_GENERATE = "false";
  });
});
