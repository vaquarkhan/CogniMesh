#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { canonicalJson, sha256Canonical } = require("../vrp/canonical");
const { resolveVrpFields } = require("../vrp/fields");
const { generateVRP } = require("../vrp/generate");
const { buildPvdmRunSummary } = require("../pvdm-run-summary");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");

describe("VRP security hardening", () => {
  it("canonicalJson sorts keys (RFC 8785-style) and stringifies floats", () => {
    const a = canonicalJson({ b: "2", a: "1" });
    const b = canonicalJson({ a: "1", b: "2" });
    assert.equal(a, b);
    assert.equal(canonicalJson({ x: 1.25 }), '{"x":"1.25"}');
  });

  it("sha256Canonical is stable across key order", () => {
    const h1 = sha256Canonical({ z: "1", a: "2" });
    const h2 = sha256Canonical({ a: "2", z: "1" });
    assert.equal(h1, h2);
  });

  it("resolveVrpFields hashes all columns when identityFields omitted", () => {
    const rows = [{ order_id: "1", amount: 10 }];
    const resolved = resolveVrpFields(rows, {});
    assert.deepEqual(resolved.identityFields, ["amount", "order_id"]);
    assert.deepEqual(resolved.contentFields, ["amount", "order_id"]);
  });

  it("resolveVrpFields does not silently default to id", () => {
    const rows = [{ order_id: "1" }];
    const resolved = resolveVrpFields(rows, { identityFields: ["id"] });
    assert.ok(resolved.error);
  });

  it("generateVRP proof binds pipeline_run_id, schema_fingerprint, and file digests", async () => {
    const rows = [{ order_id: "1", amount: 10 }];
    const vrp = await generateVRP(rows, rows, {
      pipelineRunId: "run-abc",
      chunkId: 0,
      parquetUri: "s3://bucket/chunk-000000.parquet",
      sinkFileDigest: { sha256: sha256Canonical(rows), row_count: String(rows.length) },
      icebergSnapshotId: "123456789",
      catalog: { database: "d", table: "t" },
      sign: false,
    });
    assert.equal(vrp.verdict, "PASS");
    assert.equal(vrp.proof.pipeline_run_id, "run-abc");
    assert.ok(vrp.proof.schema_fingerprint);
    assert.equal(vrp.proof.sink_artifacts.file_digests.length, 1);
    assert.ok(vrp.proof.not_before);
    assert.ok(vrp.proof.not_after);
  });

  it("runPvdmWorkload returns UNVERIFIED for empty workload", async () => {
    const contract = {
      spec: {
        transform: { pvdm: {} },
        target: { catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({ contract, source_rows: [], workload_id: "empty" });
    assert.equal(result.outcome, "unverified");
    assert.equal(result.vrp_verdict, "UNVERIFIED");
  });

  it("runPvdmWorkload uses UUID snapshot id not snap-Date.now", async () => {
    const contract = {
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://test/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 1 }],
      workload_id: "snap-test",
    });
    assert.equal(result.outcome, "committed");
    assert.ok(result.snapshot_id);
    assert.match(String(result.snapshot_id), /^\d+$/);
  });

  it("buildPvdmRunSummary stays UNVERIFIED when live PVDM is skipped", async () => {
    const summary = await buildPvdmRunSummary(
      {
        metadata: { name: "x", domain: "d" },
        spec: {
          execution: { pattern: "vaquar" },
          transform: { pvdm: { identityFields: ["order_id"] } },
        },
      },
      { runLive: false }
    );
    assert.equal(summary.vrpVerdict, "UNVERIFIED");
    assert.match(summary.message, /UNVERIFIED/);
  });
});
