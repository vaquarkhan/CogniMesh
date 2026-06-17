"use strict";

const crypto = require("crypto");
const { canonicalJson } = require("./canonical");

/** Signed bytes exclude the `signing` envelope (same as generate.js). */
function proofBodyFromEnvelope(proof) {
  if (!proof || typeof proof !== "object") {
    throw new Error("VRP proof must be an object");
  }
  const { signing: _signing, ...body } = proof;
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
  return { valid: true, reason: null };
}

/**
 * Full offline VRP proof verification for consumers.
 * Set requireSignature:false to check structure/TTL/multiset only.
 */
function verifyVrpProof(proof, options = {}) {
  const requireSignature = options.requireSignature !== false;
  const checks = {
    version: proof?.proof_version === "2",
    multiset: verifyMultisetBinding(proof),
    validity: verifyProofValidity(proof, options),
    signature: requireSignature ? verifyProofSignature(proof, options) : { valid: true, skipped: true },
  };

  const valid =
    checks.version &&
    checks.multiset.valid &&
    checks.validity.valid &&
    (checks.signature.valid || checks.signature.skipped);

  const reasons = [];
  if (!checks.version) reasons.push("unsupported or missing proof_version");
  if (!checks.multiset.valid) reasons.push(checks.multiset.reason);
  if (!checks.validity.valid) reasons.push(checks.validity.reason);
  if (requireSignature && !checks.signature.valid) reasons.push(checks.signature.reason);

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
  verifyVrpProof,
};
