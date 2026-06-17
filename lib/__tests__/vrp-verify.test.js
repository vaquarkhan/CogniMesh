#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { canonicalJson } = require("../vrp/canonical");
const { generateVRP } = require("../vrp/generate");
const {
  verifyProofSignature,
  verifyProofValidity,
  verifyVrpProof,
  signedPayloadBytes,
} = require("../vrp/verify");

describe("VRP offline verification", () => {
  it("verifyProofValidity rejects expired proofs", () => {
    const proof = {
      not_before: "2020-01-01T00:00:00.000Z",
      not_after: "2020-01-02T00:00:00.000Z",
    };
    const result = verifyProofValidity(proof, { now: "2026-01-01T00:00:00.000Z" });
    assert.equal(result.valid, false);
    assert.match(result.reason, /expired/);
  });

  it("verifyProofSignature validates Ed25519 roundtrip", () => {
    const body = { proof_version: "2", multiset: { source_hash: "a", sink_hash: "a" } };
    const bytes = Buffer.from(canonicalJson(body), "utf8");
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const signature = crypto.sign(null, bytes, privateKey);
    const proof = {
      ...body,
      signing: {
        algorithm: "Ed25519",
        signature: signature.toString("base64"),
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
        keyId: "test-key",
      },
    };
    const result = verifyProofSignature(proof);
    assert.equal(result.valid, true);
  });

  it("verifyVrpProof fails when multiset hashes differ", async () => {
    const rows = [{ id: "1", v: 1 }];
    const pass = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    pass.proof.multiset.sink_hash = "deadbeef";
    const result = verifyVrpProof(pass.proof, { requireSignature: false });
    assert.equal(result.valid, false);
    assert.match(result.reason, /multiset mismatch/);
  });

  it("verifyVrpProof passes structurally valid unsigned proof", async () => {
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: false,
    });
    const result = verifyVrpProof(vrp.proof, { requireSignature: false });
    assert.equal(result.valid, true);
    assert.equal(result.verdict, "VERIFIED");
  });

  it("verifyVrpProof validates dev-signed proof with embedded public key", async () => {
    process.env.VRP_SIGNING_MODE = "dev";
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sign: true,
    });
    const bytes = signedPayloadBytes(vrp.proof);
    assert.ok(bytes.length > 0);
    const result = verifyVrpProof(vrp.proof);
    assert.equal(result.valid, true, result.reason);
    delete process.env.VRP_SIGNING_MODE;
  });
});
