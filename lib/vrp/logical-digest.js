"use strict";

const { hashMultiset } = require("./multiset");
const { sha256Canonical } = require("./canonical");

/** Logical content digest — stable across Iceberg compaction (same rows, new files). */
function logicalContentDigest(rows, hashFields) {
  return hashMultiset(rows, hashFields);
}

function sinkLogicalArtifact(rows, hashFields) {
  return {
    logical_content_hash: logicalContentDigest(rows, hashFields),
    row_count: String(rows.length),
    compaction_safe: true,
  };
}

function verifyLogicalDigest(proof, sinkRows, hashFields) {
  const stored = proof?.sink_artifacts?.logical_content;
  if (!stored?.logical_content_hash) {
    return { valid: true, skipped: true, reason: "no logical_content in proof" };
  }
  if (!sinkRows?.length) {
    return { valid: true, skipped: true, reason: "no sink rows to recompute logical digest" };
  }
  const recomputed = logicalContentDigest(sinkRows, hashFields);
  const valid = recomputed === stored.logical_content_hash;
  return {
    valid,
    reason: valid ? null : "logical content hash mismatch (post-compaction check)",
    logical_content_hash: recomputed,
  };
}

module.exports = {
  logicalContentDigest,
  sinkLogicalArtifact,
  verifyLogicalDigest,
};
