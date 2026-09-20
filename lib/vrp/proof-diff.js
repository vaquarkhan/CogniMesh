"use strict";

/**
 * Cryptographic diff of two VRP proofs. Iceberg time travel shows table versions;
 * this shows whether content, schema, source snapshot, or profile actually changed.
 */
function pick(proof, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), proof);
}

const COMPARE_FIELDS = [
  ["verdict", "verdict"],
  ["conformance_profile", "conformance profile"],
  ["schema_fingerprint", "schema fingerprint"],
  ["source_snapshot_id", "source snapshot"],
  ["multiset.source_hash", "source hash"],
  ["multiset.sink_hash", "sink hash"],
  ["multiset.identity_source_hash", "identity source hash"],
  ["multiset.identity_sink_hash", "identity sink hash"],
  ["pipeline_run_id", "pipeline run"],
];

function publishedSnapshot(proof) {
  return proof?.commit_receipt?.iceberg_snapshot_id || proof?.iceberg_snapshot_id || null;
}

function diffProofs(left, right) {
  if (!left || !right) {
    const err = new Error("two VRP proofs are required to diff");
    err.code = "PROOF_DIFF_INVALID";
    throw err;
  }
  const changes = [];
  for (const [path, label] of COMPARE_FIELDS) {
    const a = pick(left, path);
    const b = pick(right, path);
    if (String(a ?? "") !== String(b ?? "")) {
      changes.push({ field: path, label, left: a ?? null, right: b ?? null });
    }
  }
  const snapA = publishedSnapshot(left);
  const snapB = publishedSnapshot(right);
  if (String(snapA ?? "") !== String(snapB ?? "")) {
    changes.push({ field: "iceberg_snapshot_id", label: "catalog snapshot", left: snapA, right: snapB });
  }
  return {
    identical: changes.length === 0,
    changeCount: changes.length,
    changes,
    left: {
      proof_id: left.proof_id || null,
      verdict: left.verdict || null,
      snapshot: snapA,
    },
    right: {
      proof_id: right.proof_id || null,
      verdict: right.verdict || null,
      snapshot: snapB,
    },
  };
}

module.exports = { diffProofs, publishedSnapshot };
