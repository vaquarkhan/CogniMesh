"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function logPath() {
  return process.env.VRP_TRANSPARENCY_LOG || path.join(process.cwd(), "data", "vrp-transparency-log.jsonl");
}

function proofId(proof) {
  const basis = [
    proof.pipeline_run_id,
    proof.chunk_sequence,
    proof.multiset?.source_hash,
    proof.signed_at,
  ].join("|");
  return crypto.createHash("sha256").update(basis).digest("hex");
}

function appendTransparencyEntry(proof) {
  const entry = {
    proof_id: proofId(proof),
    pipeline_run_id: proof.pipeline_run_id,
    iceberg_snapshot_id: proof.iceberg_snapshot_id || null,
    table: proof.table,
    source_hash: proof.multiset?.source_hash,
    sink_hash: proof.multiset?.sink_hash,
    signed_at: proof.signed_at,
    key_id: proof.signing?.keyId || null,
  };
  const file = logPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

function loadTransparencyLog() {
  const file = logPath();
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function verifyInTransparencyLog(proof) {
  const id = proofId(proof);
  const entries = loadTransparencyLog();
  const match = entries.find((e) => e.proof_id === id);
  if (!match) {
    return { valid: false, reason: "proof not found in transparency log" };
  }
  if (match.source_hash !== proof.multiset?.source_hash) {
    return { valid: false, reason: "transparency log source_hash mismatch" };
  }
  return { valid: true, entry: match };
}

module.exports = {
  proofId,
  appendTransparencyEntry,
  loadTransparencyLog,
  verifyInTransparencyLog,
};
