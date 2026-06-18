"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { s3Enabled, putJsonObject, getJsonObject } = require("../aws/s3-proof-io");

function logPath() {
  return process.env.VRP_TRANSPARENCY_LOG || path.join(process.cwd(), "data", "vrp-transparency-log.jsonl");
}

function isS3Log() {
  const p = logPath();
  return p.startsWith("s3://");
}

function s3LogPrefix() {
  const p = logPath();
  if (!p.startsWith("s3://")) return "transparency/vrp";
  const idx = p.indexOf("/", 5);
  return idx === -1 ? "transparency/vrp" : p.slice(idx + 1);
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

async function appendTransparencyEntry(proof) {
  if (process.env.VRP_INJECT_TRANSPARENCY_FAIL === "true") {
    throw new Error("S3 log unavailable");
  }
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
  if (!file.startsWith("s3://")) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  }

  if (s3Enabled()) {
    const key = `${s3LogPrefix()}/${entry.proof_id}.json`;
    await putJsonObject(key, entry);
  }

  return entry;
}

function loadTransparencyLog() {
  const file = logPath();
  if (file.startsWith("s3://") || !fs.existsSync(file)) return [];
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

async function verifyInTransparencyLogAsync(proof) {
  const id = proofId(proof);
  const local = verifyInTransparencyLog(proof);
  if (local.valid) return local;
  if (!s3Enabled()) return local;

  try {
    const key = `${s3LogPrefix()}/${id}.json`;
    const match = await getJsonObject(key);
    if (!match) return { valid: false, reason: "proof not found in S3 transparency log" };
    if (match.source_hash !== proof.multiset?.source_hash) {
      return { valid: false, reason: "S3 transparency log source_hash mismatch" };
    }
    return { valid: true, entry: match, source: "s3" };
  } catch {
    return { valid: false, reason: "proof not found in S3 transparency log" };
  }
}

module.exports = {
  proofId,
  appendTransparencyEntry,
  loadTransparencyLog,
  verifyInTransparencyLog,
  verifyInTransparencyLogAsync,
};
