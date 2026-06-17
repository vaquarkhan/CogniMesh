#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { generateVRP } = require("../vrp/generate");
const { buildDecisionAttestation, verifyDecisionAttestation } = require("../vrp/decision-attestation");

async function signedInputProof(rows) {
  process.env.VRP_SIGNING_MODE = "dev";
  const vrp = await generateVRP(rows, rows, {
    identityFields: ["id"],
    contentFields: ["id", "v"],
    pipelineRunId: "run-agent-1",
    sign: true,
  });
  delete process.env.VRP_SIGNING_MODE;
  return vrp.proof;
}

describe("decision attestation", () => {
  it("buildDecisionAttestation fails without sessionId", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
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
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    vrp.proof.multiset.sink_hash = "tampered";
    const result = await buildDecisionAttestation({
      sessionId: "sess-1",
      inputProofs: [vrp.proof],
      outputPayload: { decision: "approve" },
      sign: false,
    });
    assert.equal(result.verdict, "FAIL");
  });

  it("buildDecisionAttestation binds verified inputs and output hash", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
    const output = { decision: "approve", score: "92" };
    const result = await buildDecisionAttestation({
      sessionId: "sess-abc",
      decisionId: "dec-1",
      pipelineRunId: "run-agent-1",
      inputProofs: [proof],
      outputPayload: output,
      toolCalls: [{ name: "query_orders", proofId: proof.pipeline_run_id }],
      icebergSnapshotId: "snap-uuid-1",
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(result.attestation.session_id, "sess-abc");
    assert.equal(result.attestation.inputs.length, 1);
    assert.equal(result.attestation.inputs[0].source_hash, proof.multiset.source_hash);
    assert.ok(result.attestation.signing?.signature);
    assert.ok(result.attestation.nonce);
  });

  it("verifyDecisionAttestation passes for valid attestation", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
    const output = { decision: "approve" };
    const toolCalls = [{ name: "query_orders" }];
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: output,
      toolCalls,
    });
    const verified = verifyDecisionAttestation(built.attestation, { outputPayload: output, toolCalls });
    assert.equal(verified.valid, true, verified.reason);
    assert.equal(verified.verdict, "VERIFIED");
  });

  it("verifyDecisionAttestation fails when output hash mismatches", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: { decision: "approve" },
    });
    const verified = verifyDecisionAttestation(built.attestation, { outputPayload: { decision: "deny" } });
    assert.equal(verified.valid, false);
    assert.match(verified.reason, /output_hash mismatch/);
  });

  it("verifyDecisionAttestation fails when signature is stripped", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
    const built = await buildDecisionAttestation({
      sessionId: "sess-xyz",
      inputProofs: [proof],
      outputPayload: { decision: "approve" },
    });
    delete built.attestation.signing;
    const verified = verifyDecisionAttestation(built.attestation);
    assert.equal(verified.valid, false);
  });

  it("attestation includes replay-binding fields", async () => {
    const proof = await signedInputProof([{ id: "1", v: 1 }]);
    const built = await buildDecisionAttestation({
      sessionId: "sess-replay",
      decisionId: "dec-replay",
      inputProofs: [proof],
      outputPayload: { x: "1" },
    });
    assert.ok(built.attestation.not_before);
    assert.ok(built.attestation.not_after);
    assert.equal(built.attestation.decision_id, "dec-replay");
    assert.equal(built.attestation.pipeline_run_id, "run-agent-1");
  });
});
