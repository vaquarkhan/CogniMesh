"use strict";

const fs = require("fs");
const path = require("path");

function durableLogPath() {
  if (process.env.PVDM_DURABLE_LOG) return process.env.PVDM_DURABLE_LOG;
  if (process.env.ICEBERG_SNAPSHOT_STATE) {
    const state = process.env.ICEBERG_SNAPSHOT_STATE;
    return path.join(path.dirname(state), `pvdm-durable-${path.basename(state)}`);
  }
  return path.join(process.cwd(), "data", "pvdm-durable-log.json");
}

function loadLog() {
  const file = durableLogPath();
  if (!fs.existsSync(file)) return {};
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLog(state) {
  const file = durableLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function loadWorkload(workloadId) {
  if (!workloadId) return null;
  return loadLog()[workloadId] || null;
}

function recordChunkVerified(workloadId, chunkId, draft) {
  const state = loadLog();
  const current = state[workloadId] || { outcome: "in_progress", chunks: {} };
  current.chunks = current.chunks || {};
  current.chunks[String(chunkId)] = {
    outcome: "verified",
    chunkId,
    parquetUri: draft.parquetUri,
    localPath: draft.localPath,
    proof: draft.proof,
    full_sha256: draft.readBack?.full_sha256,
    footer_sha256: draft.readBack?.footer_sha256,
    digest_type: draft.readBack?.digest_type,
  };
  current.outcome = "in_progress";
  state[workloadId] = current;
  saveLog(state);
}

function recordWorkloadCommitted(workloadId, result) {
  const state = loadLog();
  const current = state[workloadId] || { chunks: {} };
  current.outcome = "committed";
  current.snapshot_id = result.snapshot_id;
  current.vrp_verdict = "PASS";
  current.proof = result.proof;
  current.committed_at = new Date().toISOString();
  state[workloadId] = current;
  saveLog(state);
}

function recordWorkloadFailed(workloadId, outcome) {
  const state = loadLog();
  const current = state[workloadId] || { chunks: {} };
  current.outcome = outcome;
  state[workloadId] = current;
  saveLog(state);
}

function verifiedDrafts(workloadId) {
  const wl = loadWorkload(workloadId);
  if (!wl?.chunks) return [];
  return Object.values(wl.chunks)
    .filter((c) => c.outcome === "verified")
    .sort((a, b) => Number(a.chunkId) - Number(b.chunkId));
}

module.exports = {
  durableLogPath,
  loadWorkload,
  recordChunkVerified,
  recordWorkloadCommitted,
  recordWorkloadFailed,
  verifiedDrafts,
};
