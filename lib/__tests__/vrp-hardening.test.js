#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.ICEBERG_SNAPSHOT_STATE = require("path").join(
  require("os").tmpdir(),
  `iceberg-snapshots-hardening-${process.pid}.json`
);

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { generateVRP } = require("../vrp/generate");
const { verifyVrpProof } = require("../vrp/verify");
const { toMinorUnits, scaleMinor } = require("../vrp/money");
const { hashKeyPII } = require("../vrp/merkle");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");

describe("VRP hardening roadmap (100%)", () => {
  it("aggregate swap attack FAILs while global sum unchanged", async () => {
    const source = [
      { group: "A", id: "1", amount: "100.00" },
      { group: "B", id: "2", amount: "50.00" },
    ];
    const sink = [
      { group: "A", amount: "50.00" },
      { group: "B", amount: "100.00" },
    ];
    const pvdmSpec = {
      vrp: {
        mode: "aggregate",
        groupBy: ["group"],
        amountField: "amount",
        feeMultiplier: "1",
        moneyFields: ["amount"],
      },
    };
    const vrp = await generateVRP(source, sink, { pvdmSpec, sign: false });
    assert.equal(vrp.verdict, "FAIL");
    assert.ok(vrp.proof.failure_localization?.merkle_source_root);
    assert.ok(vrp.proof.failure_localization?.offending_leaf_hashes?.length);
    const failed = vrp.proof.transform_verification.invariants.find((c) => c.id.startsWith("group_sum:"));
    assert.ok(failed);
    assert.equal(failed.pass, false);
  });

  it("derived sum invariant uses minor units for money", () => {
    assert.equal(toMinorUnits("10.50"), 1050n);
    assert.equal(scaleMinor(1000n, "0.98"), 980n);
  });

  it("failure localization uses hashed keys not raw PII", async () => {
    const source = [{ id: "secret-ssn-123", v: 1 }];
    const sink = [{ id: "secret-ssn-123", v: 2 }];
    const vrp = await generateVRP(source, sink, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    assert.equal(vrp.verdict, "FAIL");
    const hashes = vrp.proof.failure_localization?.offending_key_hashes || [];
    assert.ok(hashes.length);
    assert.ok(!JSON.stringify(vrp.proof.failure_localization).includes("secret-ssn"));
    assert.equal(hashes[0], hashKeyPII("secret-ssn-123|1"));
  });

  it("contract_hash binding verified on replay", async () => {
    const contract = {
      metadata: { name: "c", domain: "d", version: "1.0.0" },
      spec: { transform: { pvdm: {} } },
    };
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      contract,
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    assert.ok(vrp.proof.contract_binding?.contract_hash);
    const ok = verifyVrpProof(vrp.proof, {
      requireSignature: false,
      requireSnapshotPin: false,
      contract,
    });
    assert.equal(ok.valid, true, ok.reason);
    const tampered = { ...contract, spec: { transform: { pvdm: { extra: true } } } };
    const bad = verifyVrpProof(vrp.proof, {
      requireSignature: false,
      requireSnapshotPin: false,
      contract: tampered,
    });
    assert.equal(bad.valid, false);
    assert.match(bad.reason, /contract_hash/);
  });

  it("environment_binding pins table_uuid", async () => {
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      catalog: { database: "sales", table: "orders" },
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    assert.ok(vrp.proof.environment_binding?.table_uuid);
    assert.ok(vrp.proof.environment_binding?.environment);
    const verified = verifyVrpProof(vrp.proof, { requireSignature: false, requireSnapshotPin: false });
    assert.equal(verified.valid, true, verified.reason);
  });

  it("logical_content_hash survives compaction (physical digest secondary)", async () => {
    const rows = [{ id: "1", v: 10 }];
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      parquetUri: "s3://b/f.parquet",
      sinkFileDigest: { sha256: "stale-after-compaction", row_count: "1" },
      sign: false,
    });
    assert.equal(vrp.proof.sink_artifacts.logical_content.compaction_safe, true);
    const verified = verifyVrpProof(vrp.proof, {
      requireSignature: false,
      requireSnapshotPin: false,
      sinkRows: rows,
      localPath: "/nonexistent/file.parquet",
    });
    assert.equal(verified.valid, true, verified.reason);
    assert.equal(verified.checks.fileDigest.skipped, true);
  });

  it("reproducible_computation claim binds transform and output", async () => {
    const rows = [{ id: "1", amount: "5.00" }];
    const pvdmSpec = { vrp: { mode: "identity", amountField: "amount", moneyFields: ["amount"] } };
    const vrp = await generateVRP(rows, rows, { pvdmSpec, sign: false });
    const claim = vrp.proof.reproducible_computation;
    assert.equal(claim.claim_version, "1");
    assert.ok(claim.transform_content_hash);
    assert.equal(claim.output_logical_hash, vrp.proof.sink_artifacts.logical_content.logical_content_hash);
  });

  it("signing misconfiguration blocks publish (fault injection)", async () => {
    process.env.VRP_SIGN_ON_GENERATE = "true";
    process.env.VRP_SIGNING_MODE = "invalid-mode";
    const contract = {
      metadata: { name: "sign-fail", domain: "d" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://t/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 1 }],
      workload_id: "signing-fault",
    });
    delete process.env.VRP_SIGNING_MODE;
    process.env.VRP_SIGN_ON_GENERATE = "false";
    assert.equal(result.outcome, "signing_failed");
    assert.equal(result.vrp_verdict, "FAIL");
    assert.notEqual(result.outcome, "committed");
  });

  it("transparency log outage blocks publish (fault injection)", async () => {
    process.env.VRP_SIGN_ON_GENERATE = "true";
    process.env.VRP_SIGNING_MODE = "dev";
    process.env.VRP_INJECT_TRANSPARENCY_FAIL = "true";
    const contract = {
      metadata: { name: "log-fail", domain: "d" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://t/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 1 }],
      workload_id: "transparency-fault",
    });
    delete process.env.VRP_SIGNING_MODE;
    delete process.env.VRP_INJECT_TRANSPARENCY_FAIL;
    process.env.VRP_SIGN_ON_GENERATE = "false";
    assert.equal(result.outcome, "publish_blocked");
    assert.equal(result.vrp_verdict, "FAIL");
  });

  it("conformance vectors: known-good verifies, tampered fails", async () => {
    const fixtureDir = path.join(__dirname, "../../fixtures/vrp-conformance");
    const good = JSON.parse(fs.readFileSync(path.join(fixtureDir, "identity-pass.json"), "utf8"));
    const tampered = JSON.parse(fs.readFileSync(path.join(fixtureDir, "identity-tampered.json"), "utf8"));
    // Pin time within the proof's validity window so test doesn't depend on clock
    const now = good.not_before ? new Date(new Date(good.not_before).getTime() + 60000).toISOString() : undefined;
    const goodResult = verifyVrpProof(good, { requireSignature: false, now });
    assert.equal(goodResult.valid, true, goodResult.reason);
    const badResult = verifyVrpProof(tampered, { requireSignature: false, now });
    assert.equal(badResult.valid, false);
  });
});
