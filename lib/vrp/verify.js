"use strict";

const crypto = require("crypto");
const fs = require("fs");
const { canonicalJson } = require("./canonical");
const { verifyInTransparencyLog } = require("./transparency-log");

/** Signed bytes exclude the `signing` envelope (same as generate.js). */
function proofBodyFromEnvelope(proof) {
  if (!proof || typeof proof !== "object") {
    throw new Error("VRP proof must be an object");
  }
  const { signing: _signing, proof_id: _proofId, ...body } = proof;
  return body;
}

function signedPayloadBytes(proof) {
  return Buffer.from(canonicalJson(proofBodyFromEnvelope(proof)), "utf8");
}

function verifySignatureWithPublicKey(messageBytes, signatureB64, publicKeyPem, algorithm) {
  const sig = Buffer.from(signatureB64, "base64");
  const key = crypto.createPublicKey(publicKeyPem);

  if (algorithm === "Ed25519" || algorithm === "ed25519") {
    return crypto.verify(null, messageBytes, key, sig);
  }

  if (algorithm === "ECDSA_SHA_256" || algorithm === "ECDSA_SHA_384") {
    const hashAlg = algorithm === "ECDSA_SHA_384" ? "SHA384" : "SHA256";
    const verifier = crypto.createVerify(hashAlg);
    verifier.update(messageBytes);
    verifier.end();
    return verifier.verify(key, sig);
  }

  throw new Error(`Unsupported VRP signing algorithm: ${algorithm}`);
}

/**
 * Verify cryptographic signature on a VRP proof envelope (offline, public key only).
 * KMS ECDSA_SHA_256 with MessageType RAW hashes message with SHA-256 before signing;
 * crypto.createVerify('SHA256') mirrors that behavior.
 */
function verifyProofSignature(proof, options = {}) {
  const signing = proof?.signing;
  if (!signing?.signature) {
    return { valid: false, reason: "missing signature" };
  }

  const publicKeyPem = options.publicKeyPem || signing.publicKeyPem;
  if (!publicKeyPem) {
    return { valid: false, reason: "public key required (pass publicKeyPem or embed in proof.signing)" };
  }

  try {
    const bytes = signedPayloadBytes(proof);
    const valid = verifySignatureWithPublicKey(bytes, signing.signature, publicKeyPem, signing.algorithm);
    return {
      valid,
      reason: valid ? null : "signature mismatch",
      keyId: signing.keyId || null,
      algorithm: signing.algorithm,
      source: signing.source || null,
    };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

function verifyProofValidity(proof, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  if (!proof?.not_before || !proof?.not_after) {
    return { valid: false, reason: "missing not_before/not_after" };
  }
  const ts = now.getTime();
  const notBefore = new Date(proof.not_before).getTime();
  const notAfter = new Date(proof.not_after).getTime();
  if (Number.isNaN(notBefore) || Number.isNaN(notAfter)) {
    return { valid: false, reason: "invalid validity window" };
  }
  if (ts < notBefore) return { valid: false, reason: "proof not yet valid" };
  if (ts > notAfter) return { valid: false, reason: "proof expired" };
  return { valid: true, reason: null };
}

function verifyMultisetBinding(proof) {
  const multiset = proof?.multiset;
  if (!multiset?.source_hash || !multiset?.sink_hash) {
    return { valid: false, reason: "missing multiset hashes" };
  }
  if (multiset.source_hash !== multiset.sink_hash) {
    return { valid: false, reason: "multiset mismatch (source_hash != sink_hash)" };
  }
  if (multiset.sink_materialization !== "read_back") {
    return { valid: false, reason: "sink not independently materialized (read_back required)" };
  }
  return { valid: true, reason: null };
}

function verifySinkFileDigest(proof, options = {}) {
  const digests = proof?.sink_artifacts?.file_digests || [];
  if (!digests.length) {
    return { valid: true, skipped: true, reason: "no file digests in proof" };
  }
  const localPath = options.localPath;
  if (!localPath) {
    return { valid: true, skipped: true, reason: "no localPath provided for byte re-hash" };
  }
  if (!fs.existsSync(localPath)) {
    return { valid: false, reason: `sink file missing: ${localPath}` };
  }
  const bytes = fs.readFileSync(localPath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const match = digests.every((d) => d.sha256 === sha256);
  return {
    valid: match,
    reason: match ? null : "persisted sink bytes do not match proof file digest",
    sha256,
  };
}

/**
 * Full offline VRP proof verification for consumers.
 */
function verifyVrpProof(proof, options = {}) {
  const requireSignature = options.requireSignature !== false;
  const checks = {
    version: proof?.proof_version === "2",
    multiset: verifyMultisetBinding(proof),
    validity: verifyProofValidity(proof, options),
    snapshot: options.requireSnapshotPin === false || proof?.iceberg_snapshot_id
      ? { valid: true, skipped: !proof?.iceberg_snapshot_id }
      : { valid: false, reason: "missing iceberg_snapshot_id for snapshot-pinned reads" },
    fileDigest: verifySinkFileDigest(proof, options),
    signature: requireSignature ? verifyProofSignature(proof, options) : { valid: true, skipped: true },
    transparency: options.checkTransparencyLog
      ? verifyInTransparencyLog(proof)
      : { valid: true, skipped: true },
  };

  const valid =
    checks.version &&
    checks.multiset.valid &&
    checks.validity.valid &&
    (checks.snapshot.valid || checks.snapshot.skipped) &&
    (checks.fileDigest.valid || checks.fileDigest.skipped) &&
    (checks.signature.valid || checks.signature.skipped) &&
    (checks.transparency.valid || checks.transparency.skipped);

  const reasons = [];
  if (!checks.version) reasons.push("unsupported or missing proof_version");
  if (!checks.multiset.valid) reasons.push(checks.multiset.reason);
  if (!checks.validity.valid) reasons.push(checks.validity.reason);
  if (!checks.snapshot.valid && !checks.snapshot.skipped) reasons.push(checks.snapshot.reason);
  if (!checks.fileDigest.valid && !checks.fileDigest.skipped) reasons.push(checks.fileDigest.reason);
  if (requireSignature && !checks.signature.valid) reasons.push(checks.signature.reason);
  if (options.checkTransparencyLog && !checks.transparency.valid) reasons.push(checks.transparency.reason);

  return {
    valid,
    verdict: valid ? "VERIFIED" : "UNVERIFIED",
    checks,
    reason: reasons.filter(Boolean).join("; ") || null,
  };
}

module.exports = {
  proofBodyFromEnvelope,
  signedPayloadBytes,
  verifyProofSignature,
  verifyProofValidity,
  verifyMultisetBinding,
  verifySinkFileDigest,
  verifyVrpProof,
};
