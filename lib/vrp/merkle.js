"use strict";

const crypto = require("crypto");
const { canonicalJson, sha256Canonical } = require("./canonical");

function hashLeaf(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function merkleRoot(leaves) {
  if (!leaves.length) return hashLeaf("empty");
  let level = leaves.map((l) => hashLeaf(l));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(hashLeaf(`${left}|${right}`));
    }
    level = next;
  }
  return level[0];
}

function rowLeaf(row, fields) {
  return sha256Canonical(fields.map((f) => String(row[f] ?? "")));
}

function buildRowMerkle(rows, fields) {
  const leaves = rows.map((r) => rowLeaf(r, fields));
  return { root: merkleRoot(leaves), leaves, row_count: rows.length };
}

/** Localize first divergent leaf index by comparing sorted leaf sets. */
function localizeDivergence(sourceLeaves, sinkLeaves, limit = 5) {
  const sinkSet = new Set(sinkLeaves);
  const offending = [];
  for (let i = 0; i < sourceLeaves.length && offending.length < limit; i++) {
    const leaf = sourceLeaves[i];
    if (!sinkSet.has(leaf)) {
      offending.push({ index: String(i), leaf_hash: leaf });
    }
  }
  if (!offending.length && sourceLeaves.length !== sinkLeaves.length) {
    offending.push({
      index: "0",
      leaf_hash: hashLeaf(`row_count:${sourceLeaves.length}!=${sinkLeaves.length}`),
    });
  }
  return {
    partition: { chunk_sequence: "0" },
    merkle_source_root: merkleRoot(sourceLeaves),
    merkle_sink_root: merkleRoot(sinkLeaves),
    offending_leaf_hashes: offending,
  };
}

function hashKeyPII(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

module.exports = {
  merkleRoot,
  rowLeaf,
  buildRowMerkle,
  localizeDivergence,
  hashKeyPII,
};
