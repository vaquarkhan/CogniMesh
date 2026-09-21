#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.VRP_GATEWAY_SECRET = "test-gateway-secret";
process.env.ICEBERG_SNAPSHOT_STATE = require("path").join(
  require("os").tmpdir(),
  `iceberg-snapshots-proof-gateway-${process.pid}.json`
);
process.env.PVDM_DURABLE_LOG = require("path").join(
  require("os").tmpdir(),
  `pvdm-durable-gateway-${process.pid}.json`
);
process.env.PVDM_NONCE_LEDGER = require("path").join(
  require("os").tmpdir(),
  `pvdm-nonce-gateway-${process.pid}.json`
);

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");
const { serveProofGatedDataset, resolveGatewayInputs } = require("../vrp/proof-gateway");
const { buildDecisionAttestation } = require("../vrp/decision-attestation");
const { commitIcebergSnapshot, loadState } = require("../aws/glue-iceberg");

describe("proof-aware data gateway", () => {
  it("serveProofGatedDataset returns gateway token after proof verification", async () => {
    const contract = {
      metadata: { name: "gw", domain: "commerce" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://lake/", catalog: { database: "commerce", table: "gw" } },
      },
    };
    const workloadId = `gw-run-${process.pid}`;
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 2 }],
      workload_id: workloadId,
    });
    assert.equal(result.outcome, "committed");

    const fs = require("fs");
    const stagingDir = require("../vrp/chunk-store").stagingRoot();
    const chunkDir = `${stagingDir}/${workloadId}`;
    const chunkPath = fs
      .readdirSync(chunkDir)
      .map((f) => `${chunkDir}/${f}`)
      .find((p) => p.endsWith(".parquet") || p.endsWith(".ndjson"));
    assert.ok(chunkPath);

    const served = await serveProofGatedDataset({
      sessionId: "sess-gw-1",
      proof: result.proof,
      localPath: chunkPath,
      limit: 10,
    });
    assert.ok(served.gatewayToken);
    assert.equal(served.gatewayStamp.input_enforced, true);
    assert.equal(served.rows.length, 1);

    const resolved = await resolveGatewayInputs(served.gatewayToken, "sess-gw-1");
    assert.equal(resolved.proof.proof_id, result.proof.proof_id);

    const attestation = await buildDecisionAttestation({
      sessionId: "sess-gw-1",
      gatewayToken: served.gatewayToken,
      outputPayload: { decision: "ok" },
      sign: false,
    });
    assert.equal(attestation.verdict, "PASS");
    assert.equal(attestation.attestation.inputs[0].gateway_enforced, true);
  });

  it("commitIcebergSnapshot uses monotonic catalog state when Glue disabled", async () => {
    process.env.GLUE_ICEBERG_ENABLED = "false";
    const catalog = { database: "d", table: "t" };
    const first = await commitIcebergSnapshot(catalog, { multiset: { source_hash: "a", sink_hash: "a" } });
    const second = await commitIcebergSnapshot(catalog, { multiset: { source_hash: "b", sink_hash: "b" } });
    assert.equal(BigInt(second.snapshotId), BigInt(first.snapshotId) + 1n);
    const state = loadState();
    assert.equal(state["d.t"].source, "catalog_state");
    delete process.env.GLUE_ICEBERG_ENABLED;
  });

  it("buildDecisionAttestation rejects declared inputs without gateway by default", async () => {
    const contract = {
      metadata: { name: "decl", domain: "d" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id"] } },
        target: { location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1" }],
      workload_id: `decl-run-${process.pid}`,
    });
    const attestation = await buildDecisionAttestation({
      sessionId: "sess-decl",
      inputProofs: [result.proof],
      outputPayload: { x: 1 },
      sign: false,
    });
    assert.equal(attestation.verdict, "UNVERIFIED");
    assert.match(attestation.error, /gatewayToken/);
  });

  it("serveProofGatedDataset enforces subscription token when productId set", async () => {
    const contract = {
      metadata: { name: "gw-sub", domain: "commerce" },
      spec: {
        transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
        target: { location: "s3://lake/", catalog: { database: "commerce", table: "gw_sub" } },
      },
    };
    const workloadId = `gw-sub-${process.pid}`;
    const result = await runPvdmWorkload({
      contract,
      source_rows: [{ id: "1", v: 2 }],
      workload_id: workloadId,
    });
    assert.equal(result.outcome, "committed");

    await assert.rejects(
      () =>
        serveProofGatedDataset({
          sessionId: "sess-sub-deny",
          proof: result.proof,
          productId: "commerce-gw-sub",
        }),
      (err) => err.code === "SUBSCRIPTION_TOKEN_DENIED"
    );

    const { mintSubscriptionToken } = require("../vrp/subscription-token");
    const minted = mintSubscriptionToken({
      product_id: "commerce-gw-sub",
      iceberg_snapshot_id: result.proof.iceberg_snapshot_id,
      vrp_verdict: "PASS",
    });
    const served = await serveProofGatedDataset({
      sessionId: "sess-sub-ok",
      proof: result.proof,
      productId: "commerce-gw-sub",
      subscriptionToken: minted.token,
    });
    assert.ok(served.gatewayToken);
  });
});
