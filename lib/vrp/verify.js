"use strict";

const crypto = require("crypto");
const fs = require("fs");
const { canonicalJson } = require("./canonical");
const { verifyInTransparencyLog } = require("./transparency-log");
const { verifyContractBinding } = require("./contract-bind");
const { verifyEnvironmentBinding } = require("./environment-bind");
const { verifyLogicalDigest } = require("./logical-digest");
const { verifyTransformFromProof } = require("./transform-verify");

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
  const mode = multiset.mode || proof?.transform_verification?.mode || "identity";
  if (mode === "identity" && multiset.source_hash !== multiset.sink_hash) {
    return { valid: false, reason: "multiset mismatch (source_hash != sink_hash)" };
  }
  if (multiset.sink_materialization !== "read_back") {
    return { valid: false, reason: "sink not independently materialized (read_back required)" };
  }
  return { valid: true, reason: null, mode };
}

function verifyTransformInvariants(proof) {
  const tv = proof?.transform_verification;
  if (!tv) {
    return { valid: true, skipped: proof?.proof_version === "2", reason: "no transform_verification" };
  }
  const failed = (tv.invariants || []).find((c) => c.pass === false);
  if (failed) {
    return {
      valid: false,
      reason: `transform invariant failed: ${failed.id}`,
      failed_invariant: failed,
      localization: proof.failure_localization || null,
    };
  }
  return { valid: true, reason: null };
}

function verifySinkFileDigest(proof, options = {}) {
  const digests = proof?.sink_artifacts?.file_digests || [];
  if (!digests.length) {
    return { valid: true, skipped: true, reason: "no file digests in proof" };
  }
  if (options.compactionMode || proof?.sink_artifacts?.logical_content?.compaction_safe) {
    return {
      valid: true,
      skipped: true,
      reason: "physical file digest skipped — logical_content binding is primary (compaction-safe)",
    };
  }
  const localPath = options.localPath;
  if (!localPath) {
    return { valid: true, skipped: true, reason: "no localPath provided for byte re-hash" };
  }
  if (!fs.existsSync(localPath)) {
    return { valid: false, reason: `sink file missing: ${localPath}` };
  }
  const bytes = fs.readFileSync(localPath);
  const fullSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const { parquetFooterSha256 } = require("./parquet-chunk");
  const footerSha256 = parquetFooterSha256(bytes);

  const match = digests.every((d) => {
    const digestType = d.digest_type || "parquet_footer";
    if (digestType === "parquet_footer") {
      return (d.footer_sha256 || d.sha256) === footerSha256;
    }
    return (d.full_sha256 || d.sha256) === fullSha256;
  });

  return {
    valid: match,
    reason: match ? null : "persisted sink bytes do not match proof file digest",
    sha256: footerSha256,
    full_sha256: fullSha256,
  };
}

function checkPass(check) {
  if (check?.skipped) return true;
  return Boolean(check?.valid);
}

function supportedVersion(proof) {
  return proof?.proof_version === "2" || proof?.proof_version === "3";
}

function verifyVrpProof(proof, options = {}) {
  const requireSignature = options.requireSignature !== false;
  const hashFields = proof?.multiset?.identity_fields?.concat(proof?.multiset?.content_fields || []) || [];

  const checks = {
    version: supportedVersion(proof),
    multiset: verifyMultisetBinding(proof),
    transform: verifyTransformInvariants(proof),
    validity: verifyProofValidity(proof, options),
    snapshot:
      options.requireSnapshotPin === false || proof?.iceberg_snapshot_id
        ? { valid: true, skipped: !proof?.iceberg_snapshot_id }
        : { valid: false, reason: "missing iceberg_snapshot_id" },
    logicalDigest: options.sinkRows
      ? verifyLogicalDigest(proof, options.sinkRows, [...new Set(hashFields)].sort())
      : { valid: true, skipped: true, reason: "no sinkRows for logical digest recompute" },
    fileDigest: verifySinkFileDigest(proof, options),
    contract: verifyContractBinding(proof, options.contract),
    environment: verifyEnvironmentBinding(proof, options),
    signature: requireSignature ? verifyProofSignature(proof, options) : { valid: true, skipped: true },
    transparency: options.checkTransparencyLog
      ? verifyInTransparencyLog(proof)
      : { valid: true, skipped: true },
  };

  if (options.sourceRows && options.sinkRows && proof?.proof_version === "3") {
    checks.transformReplay = verifyTransformFromProof(
      proof,
      options.sourceRows,
      options.sinkRows,
      options.pvdmSpec || {},
      [...new Set(hashFields)].sort()
    );
  } else {
    checks.transformReplay = { valid: true, skipped: true };
  }

  const valid =
    checks.version &&
    checkPass(checks.multiset) &&
    checkPass(checks.transform) &&
    checkPass(checks.validity) &&
    checkPass(checks.snapshot) &&
    checkPass(checks.logicalDigest) &&
    checkPass(checks.fileDigest) &&
    checkPass(checks.contract) &&
    checkPass(checks.environment) &&
    checkPass(checks.signature) &&
    checkPass(checks.transparency) &&
    checkPass(checks.transformReplay);

  const reasons = [];
  if (!checks.version) reasons.push("unsupported or missing proof_version");
  if (!checkPass(checks.multiset)) reasons.push(checks.multiset.reason);
  if (!checkPass(checks.transform)) reasons.push(checks.transform.reason);
  if (!checkPass(checks.validity)) reasons.push(checks.validity.reason);
  if (!checkPass(checks.snapshot)) reasons.push(checks.snapshot.reason);
  if (!checkPass(checks.logicalDigest)) reasons.push(checks.logicalDigest.reason);
  if (!checkPass(checks.fileDigest)) reasons.push(checks.fileDigest.reason);
  if (!checkPass(checks.contract)) reasons.push(checks.contract.reason);
  if (!checkPass(checks.environment)) reasons.push(checks.environment.reason);
  if (requireSignature && !checkPass(checks.signature)) reasons.push(checks.signature.reason);
  if (options.checkTransparencyLog && !checkPass(checks.transparency)) reasons.push(checks.transparency.reason);
  if (!checkPass(checks.transformReplay)) reasons.push(checks.transformReplay.reason);

  return {
    valid,
    verdict: valid ? "VERIFIED" : "UNVERIFIED",
    checks,
    reason: reasons.filter(Boolean).join("; ") || null,
    localization: proof?.failure_localization || checks.transform?.localization || null,
  };
}

module.exports = {
  proofBodyFromEnvelope,
  signedPayloadBytes,
  verifyProofSignature,
  verifyProofValidity,
  verifyMultisetBinding,
  verifyTransformInvariants,
  verifySinkFileDigest,
  verifyVrpProof,
};
