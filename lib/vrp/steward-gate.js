"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { allowDevStewardKeys } = require("./steward-key");
const { verifyProofSignature } = require("./verify");

function nonceLedgerPath() {
  if (process.env.PVDM_NONCE_LEDGER) return process.env.PVDM_NONCE_LEDGER;
  if (process.env.ICEBERG_SNAPSHOT_STATE) {
    const state = process.env.ICEBERG_SNAPSHOT_STATE;
    return path.join(path.dirname(state), `pvdm-nonce-${path.basename(state)}`);
  }
  return path.join(process.cwd(), "data", "pvdm-nonce-ledger.json");
}

function loadNonceLedger() {
  const file = nonceLedgerPath();
  if (!fs.existsSync(file)) return { seen: [] };
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : { seen: [] };
  } catch {
    return { seen: [] };
  }
}

function saveNonceLedger(ledger) {
  const file = nonceLedgerPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function fileDigest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertNonceUnused(nonce) {
  if (!nonce) return;
  const ledger = loadNonceLedger();
  const seen = new Set(ledger.seen || []);
  if (seen.has(nonce)) {
    const err = new Error("nonce already used (replay)");
    err.code = "VERIFICATION_FAILED";
    throw err;
  }
}

function commitNonces(nonces) {
  const toAdd = (Array.isArray(nonces) ? nonces : [nonces]).filter(Boolean);
  if (!toAdd.length) return;
  const ledger = loadNonceLedger();
  const seen = new Set(ledger.seen || []);
  for (const nonce of toAdd) {
    if (seen.has(nonce)) {
      const err = new Error("nonce already used (replay)");
      err.code = "VERIFICATION_FAILED";
      throw err;
    }
    seen.add(nonce);
  }
  saveNonceLedger({ seen: [...seen] });
}

function rehashLocalFile(localPath, proof) {
  if (!localPath || !fs.existsSync(localPath)) {
    const err = new Error(`published bytes missing at ${localPath || "(no path)"}`);
    err.code = "TOCTOU_FAILED";
    throw err;
  }
  const bytes = fs.readFileSync(localPath);
  const full = fileDigest(bytes);
  const bound = (proof?.sink_artifacts?.file_digests || [])[0];
  if (!bound) {
    const err = new Error("proof missing per-file content digests (paper N4)");
    err.code = "TOCTOU_FAILED";
    throw err;
  }
  if (bound.full_sha256 && bound.full_sha256 !== full) {
    const err = new Error("published bytes differ from verified bytes (post-verify tamper)");
    err.code = "TOCTOU_FAILED";
    throw err;
  }
  const expected = bound.full_sha256 || bound.sha256;
  if (expected && expected !== full && expected !== bound.footer_sha256) {
    const err = new Error("published bytes differ from verified bytes (post-verify tamper)");
    err.code = "TOCTOU_FAILED";
    throw err;
  }
  return { full, bytes };
}

/**
 * Paper §4 / N4 / N5 / N10: Metadata gate. Catalog commit is the caller's next step.
 * Rejects FAIL, bad signature, target mismatch, unused-nonce check, and TOCTOU byte drift.
 * Nonces are burned only via commitNonces() after the catalog publish succeeds.
 */
function proofGatedCommit({ proof, localPath, expectedTarget, requireSignature, consumeNonce = false }) {
  if (!proof) {
    const err = new Error("VRP proof required for metadata commit");
    err.code = "VERIFICATION_FAILED";
    throw err;
  }
  if (proof.verdict && proof.verdict !== "PASS") {
    const err = new Error(`verdict is ${proof.verdict}, not PASS`);
    err.code = "VERIFICATION_FAILED";
    throw err;
  }
  const ms = proof.multiset || {};
  if (ms.sink_materialization !== "read_back") {
    const err = new Error("VRP proof missing read-back sink materialization");
    err.code = "VERIFICATION_FAILED";
    throw err;
  }
  const mode = ms.mode || proof.transform_verification?.mode || "identity";
  if (mode === "identity") {
    if (!ms.source_hash || ms.source_hash !== ms.sink_hash) {
      const err = new Error("VRP content digest mismatch — metadata commit blocked");
      err.code = "VERIFICATION_FAILED";
      throw err;
    }
    if (ms.identity_source_hash && ms.identity_source_hash !== ms.identity_sink_hash) {
      const err = new Error("VRP identity digest mismatch — metadata commit blocked");
      err.code = "VERIFICATION_FAILED";
      throw err;
    }
  }

  const mustSign = requireSignature === true || (requireSignature !== false && !allowDevStewardKeys());
  if (mustSign || proof.signing?.signature) {
    const sig = verifyProofSignature(proof);
    if (proof.signing?.signature && !sig.valid) {
      const err = new Error(`proof signature invalid: ${sig.reason}`);
      err.code = "VERIFICATION_FAILED";
      throw err;
    }
    if (mustSign && !proof.signing?.signature) {
      const err = new Error("Steward signature required for metadata commit (paper N5)");
      err.code = "VERIFICATION_FAILED";
      throw err;
    }
  }

  if (expectedTarget && proof.target && proof.target !== expectedTarget) {
    const err = new Error("proof target does not match commit target (replay/misdirection)");
    err.code = "VERIFICATION_FAILED";
    throw err;
  }

  assertNonceUnused(proof.nonce);

  if (localPath) {
    rehashLocalFile(localPath, proof);
  }

  if (consumeNonce && proof.nonce) {
    commitNonces([proof.nonce]);
  }

  return { accepted: true, nonce: proof.nonce || null };
}

module.exports = {
  proofGatedCommit,
  rehashLocalFile,
  fileDigest,
  nonceLedgerPath,
  assertNonceUnused,
  commitNonces,
};
