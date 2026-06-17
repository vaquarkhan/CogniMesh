#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.VRP_ALLOW_DECLARED_INPUTS = "true";
process.env.ICEBERG_SNAPSHOT_STATE = require("path").join(
  require("os").tmpdir(),
  `iceberg-snapshots-attestation-${process.pid}.json`
);

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { runPvdmWorkload } = require("../../services/pvdm-runtime");
const { buildDecisionAttestation, verifyDecisionAttestation } = require("../vrp/decision-attestation");

async function workloadProof() {
  const contract = {
    metadata: { name: "agent-input", domain: "commerce" },
    spec: {
      transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "v"] } },
      target: { location: "s3://test/", catalog: { database: "d", table: "orders" } },
    },
  };
  const result = await runPvdmWorkload({
    contract,
    source_rows: [{ id: "1", v: 10 }],
    workload_id: "run-agent-1",
  });
  assert.equal(result.outcome, "committed");
  return result.proof;
}

describe("decision attestation", () => {
  it("buildDecisionAttestation fails without sessionId", async () => {
    const proof = await workloadProof();
    const result = await buildDecisionAttestation({ inputProofs: [proof], outputPayload: { ok: true } });
    assert.equal(result.verdict, "FAIL");
  });

  it("buildDecisionAttestation returns UNVERIFIED without input proofs", async () => {
    const result = await buildDecisionAttestation({
      sessionId: "sess-1",
      outputPayload: { ok: true },
    });
    assert.equal(result.verdict, "UNVERIFIED");
  });

  it("buildDecisionAttestation rejects unverified input proof", async () => {
    const proof = await workloadProof();
    proof.multiset.sink_hash = "tampered";
    const result = await buildDecisionAttestation({
      sessionId: "sess-1",
      inputProofs: [proof],
      outputPayload: { decision: "approve" },
      sign: false,
    });
    assert.equal(result.verdict, "FAIL");
  });

  it("buildDecisionAttestation binds verified inputs and output hash", async () => {
    const proof = await workloadProof();
    const output = { decision: "approve", score: "92" };
    process.env.VRP_SIGNING_MODE = "dev";
    const result = await buildDecisionAttestation({
      sessionId: "sess-abc",
      decisionId: "dec-1",
      pipelineRunId: "run-agent-1",
      inputProofs: [proof],
      outputPayload: output,
      toolCalls: [{ name: "query_orders", proofId: proof.pipeline_run_id }],
      icebergSnapshotId: proof.iceberg_snapshot_id,
    });
    delete process.env.VRP_SIGNING_MODE;
    assert.equal(result.verdict, "PASS");
    assert.equal(result.attestation.session_id, "sess-abc");
    assert.equal(result.attestation.inputs.length, 1);
    assert.equal(result.attestation.inputs[0].source_hash, proof.multiset.source_hash);
    assert.ok(result.attestation.signing?.signature);
    assert.ok(result.attestation.nonce);
  });

  it("verifyDecisionAttestation passes for valid attestation", async () => {
    const proof = await workloadProof();
    const output = { decision: "approve" };
    const toolCalls = [{ name: "query_orders" }];
    process.env.VRP_SIGNING_MODE = "dev";
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: output,
      toolCalls,
    });
    delete process.env.VRP_SIGNING_MODE;
    const verified = verifyDecisionAttestation(built.attestation, { outputPayload: output, toolCalls });
    assert.equal(verified.valid, true, verified.reason);
    assert.equal(verified.verdict, "VERIFIED");
  });

  it("verifyDecisionAttestation fails when output hash mismatches", async () => {
    const proof = await workloadProof();
    process.env.VRP_SIGNING_MODE = "dev";
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: { decision: "approve" },
    });
    delete process.env.VRP_SIGNING_MODE;
    const verified = verifyDecisionAttestation(built.attestation, { outputPayload: { decision: "deny" } });
    assert.equal(verified.valid, false);
    assert.match(verified.reason, /output_hash mismatch/);
  });

  it("verifyDecisionAttestation fails when signature is stripped", async () => {
    const proof = await workloadProof();
    process.env.VRP_SIGNING_MODE = "dev";
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: { decision: "approve" },
    });
    delete process.env.VRP_SIGNING_MODE;
    delete built.attestation.signing;
    const verified = verifyDecisionAttestation(built.attestation);
    assert.equal(verified.valid, false);
  });

  it("attestation includes replay-binding fields", async () => {
    const proof = await workloadProof();
    process.env.VRP_SIGNING_MODE = "dev";
    const built = await buildDecisionAttestation({
      sessionId: "sess-replay",
      decisionId: "dec-replay",
      inputProofs: [proof],
      outputPayload: { x: "1" },
    });
    delete process.env.VRP_SIGNING_MODE;
    assert.ok(built.attestation.not_before);
    assert.ok(built.attestation.not_after);
    assert.equal(built.attestation.decision_id, "dec-replay");
    assert.equal(built.attestation.pipeline_run_id, "run-agent-1");
  });
});
