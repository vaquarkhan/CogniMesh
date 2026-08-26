#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.ICEBERG_SNAPSHOT_STATE = require("path").join(
  require("os").tmpdir(),
  `iceberg-snapshots-paper-${process.pid}.json`
);
process.env.PVDM_DURABLE_LOG = require("path").join(
  require("os").tmpdir(),
  `pvdm-durable-paper-${process.pid}.json`
);
process.env.PVDM_NONCE_LEDGER = require("path").join(
  require("os").tmpdir(),
  `pvdm-nonce-paper-${process.pid}.json`
);

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { hashMultiset, combinePartials } = require("../vrp/multiset");
const { generateVRP } = require("../vrp/generate");
const { proofGatedCommit } = require("../vrp/steward-gate");
const { verifyTransformOracle, TransformNotVerifiable } = require("../vrp/transform-oracle");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");
const { loadState, tableKey } = require("../aws/glue-iceberg");
const { writeChunkRecords } = require("../vrp/chunk-store");
const { compileVaquarStateMachine } = require("../vaquar/pvdm-sfn");

describe("PVDM paper conformance (arXiv 2608.14643)", () => {
  it("N1/N3: keyed MSet-Add-Hash is order-independent and multiplicity-sensitive", () => {
    const a = { id: "1", v: 1 };
    const b = { id: "2", v: 2 };
    const fields = ["id", "v"];
    assert.equal(hashMultiset([a, b], fields), hashMultiset([b, a], fields));
    assert.notEqual(hashMultiset([a, a], fields), hashMultiset([a], fields));
    assert.match(hashMultiset([a], fields), /^[0-9a-f]{64}$/);
  });

  it("combining partials refuses mixed key epochs", () => {
    assert.throws(
      () =>
        combinePartials([
          { epoch: "e1", digest: hashMultiset([{ id: "1" }], ["id"]) },
          { epoch: "e2", digest: hashMultiset([{ id: "2" }], ["id"]) },
        ]),
      /multiple key epochs/
    );
  });

  it("N1 identity+content projections: mutation fails content, drop fails identity", async () => {
    const source = [
      { payment_id: "p1", amount: "10.00" },
      { payment_id: "p2", amount: "20.00" },
    ];
    const mutated = [
      { payment_id: "p1", amount: "10.00" },
      { payment_id: "p2", amount: "99.00" },
    ];
    const dropped = [{ payment_id: "p1", amount: "10.00" }];
    const mutatedVrp = await generateVRP(source, mutated, {
      identityFields: ["payment_id"],
      contentFields: ["payment_id", "amount"],
      sign: false,
    });
    assert.equal(mutatedVrp.verdict, "FAIL");
    assert.equal(mutatedVrp.proof.multiset.identity_source_hash, mutatedVrp.proof.multiset.identity_sink_hash);
    assert.notEqual(mutatedVrp.proof.multiset.source_hash, mutatedVrp.proof.multiset.sink_hash);

    const droppedVrp = await generateVRP(source, dropped, {
      identityFields: ["payment_id"],
      contentFields: ["payment_id", "amount"],
      sign: false,
    });
    assert.equal(droppedVrp.verdict, "FAIL");
    assert.notEqual(droppedVrp.proof.multiset.identity_source_hash, droppedVrp.proof.multiset.identity_sink_hash);
  });

  it("N4: Metadata gate re-hashes exact bytes and rejects post-verify tamper", async () => {
    const rows = [{ id: "1", v: 1 }];
    const written = await writeChunkRecords(0, rows, "s3://staging", { isolationId: `toctou-${process.pid}` });
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      parquetUri: written.parquetUri,
      sinkFileDigest: {
        sha256: written.sha256,
        footer_sha256: written.footer_sha256,
        full_sha256: written.full_sha256,
        digest_type: written.digest_type,
        row_count: "1",
      },
      target: "d.t",
      nonce: `nonce-toctou-${process.pid}`,
      sign: false,
    });
    assert.equal(vrp.verdict, "PASS");
    fs.appendFileSync(written.localPath, "tamper");
    assert.throws(
      () =>
        proofGatedCommit({
          proof: vrp.proof,
          localPath: written.localPath,
          expectedTarget: "d.t",
          requireSignature: false,
        }),
      /post-verify tamper/
    );
  });

  it("N5: nonce replay is rejected at the Metadata gate", async () => {
    const rows = [{ id: "1", v: 1 }];
    const written = await writeChunkRecords(1, rows, "s3://staging", { isolationId: `nonce-${process.pid}` });
    const nonce = `nonce-replay-${process.pid}`;
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      parquetUri: written.parquetUri,
      sinkFileDigest: {
        sha256: written.sha256,
        footer_sha256: written.footer_sha256,
        full_sha256: written.full_sha256,
        digest_type: written.digest_type,
        row_count: "1",
      },
      target: "d.t",
      nonce,
      sign: false,
    });
    proofGatedCommit({
      proof: vrp.proof,
      localPath: written.localPath,
      expectedTarget: "d.t",
      requireSignature: false,
      consumeNonce: true,
    });
    assert.throws(
      () =>
        proofGatedCommit({
          proof: vrp.proof,
          localPath: written.localPath,
          expectedTarget: "d.t",
          requireSignature: false,
        }),
      /nonce already used/
    );
  });

  it("N8: Profile T same-implementation oracle is refused", () => {
    const rows = [{ region: "east", amount: "10" }];
    assert.throws(
      () =>
        verifyTransformOracle({
          producedRows: rows,
          independentRows: rows,
          producerImplId: "spark-sql",
          independentImplId: "spark-sql",
        }),
      TransformNotVerifiable
    );
  });

  it("N8: Profile T independent oracle PASSes when digests match", () => {
    const rows = [{ region: "east", amount: "10" }];
    const result = verifyTransformOracle({
      producedRows: rows,
      independentRows: rows,
      producerImplId: "spark-sql",
      independentImplId: "duckdb",
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(result.profile_t_certified, true);
  });

  it("N10: VRP FAIL rolls back staged files and does not publish a snapshot", async () => {
    const contract = {
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://test/", catalog: { database: "paper_d", table: "paper_fail" } },
      },
    };
    const key = tableKey(contract.spec.target.catalog);
    const before = loadState()[key]?.snapshot_id;

    const source = [{ id: "1", v: 1 }];
    const sink = [{ id: "1", v: 99 }];
    const vrp = await generateVRP(source, sink, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    assert.equal(vrp.verdict, "FAIL");
    assert.throws(() => proofGatedCommit({ proof: vrp.proof, expectedTarget: "paper_d.paper_fail" }), /not PASS|mismatch/);

    const after = loadState()[key]?.snapshot_id;
    assert.equal(after, before);

    const ok = await runPvdmWorkload({
      contract,
      source_rows: source,
      workload_id: `paper-pass-${process.pid}`,
    });
    assert.equal(ok.outcome, "committed");
    assert.match(ok.message, /Physical → Verify → Durable → Metadata/);
    assert.equal(ok.proof.multiset.construction, "mset-add-hmac-sha256");
    assert.equal(ok.proof.conformance_profile, "A");
    assert.ok(ok.proof.nonce);
    assert.equal(ok.proof.iceberg_snapshot_id, null);
    assert.equal(ok.proof.commit_receipt.iceberg_snapshot_id, ok.snapshot_id);
    assert.ok(ok.snapshot_id);
  });

  it("Durable: timeout rolls back uncommitted chunk; resume same workload_id commits once", async () => {
    const contract = {
      metadata: { name: "durable", domain: "commerce", version: "1.0.0" },
      spec: {
        transform: {
          pvdm: {
            identityFields: ["id"],
            contentFields: ["id", "v"],
            maxChunkRecords: 2,
            rollbackThresholdMs: 30000,
          },
        },
        target: { location: "s3://staging/", catalog: { database: "d", table: `dur_${process.pid}` } },
      },
    };
    const rows = [
      { id: "1", v: 1 },
      { id: "2", v: 2 },
      { id: "3", v: 3 },
      { id: "4", v: 4 },
    ];
    let budgetCalls = 0;
    const first = await runPvdmWorkload({
      contract,
      source_rows: rows,
      workload_id: `durable-${process.pid}`,
      resume_offset: 0,
      getRemainingMs: () => {
        budgetCalls += 1;
        return budgetCalls <= 1 ? 120000 : 500;
      },
    });
    assert.equal(first.outcome, "rolled_back");
    assert.equal(first.resume_offset, 2);
    assert.equal(loadState()[tableKey(contract.spec.target.catalog)]?.snapshot_id, undefined);

    const second = await runPvdmWorkload({
      contract,
      source_rows: rows,
      workload_id: `durable-${process.pid}`,
      resume_offset: first.resume_offset,
    });
    assert.equal(second.outcome, "committed");
    assert.equal(second.chunks, 2);
    assert.ok(second.snapshot_id);

    const replay = await runPvdmWorkload({
      contract,
      source_rows: rows,
      workload_id: `durable-${process.pid}`,
      resume_offset: 0,
    });
    assert.equal(replay.outcome, "committed");
    assert.match(replay.message, /already COMMITTED/);
  });

  it("SFN routes signing_failed, publish_blocked, and unverified fail-closed", () => {
    const sm = compileVaquarStateMachine(
      { metadata: { name: "n", version: "1", domain: "d" } },
      { namePrefix: "cognimesh-dev" }
    );
    const choices = sm.States.RouteOutcome.Choices.map((c) => [c.StringEquals, c.Next]);
    assert.deepEqual(
      choices.find((c) => c[0] === "signing_failed"),
      ["signing_failed", "VerificationFailed"]
    );
    assert.deepEqual(
      choices.find((c) => c[0] === "publish_blocked"),
      ["publish_blocked", "VerificationFailed"]
    );
    assert.deepEqual(choices.find((c) => c[0] === "unverified"), ["unverified", "Unverified"]);
    assert.equal(sm.States.Unverified.Error, "Unverified");
  });
});
